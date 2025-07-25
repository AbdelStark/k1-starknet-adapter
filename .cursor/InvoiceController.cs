using K1MiniServer.DTOs;
using K1MiniServer.Models;
using K1MiniServer.Services;
using K1MiniServer.Support;
using LimeBean;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RestSharp;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace K1MiniServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class InvoiceController : ControllerBase
    {
        [HttpGet("Decode/{invoice}")]
        public ContentResult Decode(string invoice)
        {
            try
            {
                int amountRequested = LightningService.DecodeAmount(invoice);
                return Content(amountRequested.ToString());
            }
            catch (Exception ex)
            {
                return Content(ex.Message);
            }
        }

        [HttpPost]
        public ContentResult Post([FromBody] InvoiceDTO invoice)
        {
            Response.Headers["content-type"] = "application/json";

            ResultDTO result = new ResultDTO();
            result.success = false;
            int serviceId = 2;
            try
            {
                string serializedInput = JsonConvert.SerializeObject(invoice);

                string signature = string.Empty;
                if (Request.Headers.ContainsKey("Signature")) signature = Request.Headers["Signature"];

                int deviceId = SecurityService.ValidateRequest(serializedInput, signature);
                DeviceModel device = new DeviceModel(deviceId);

                //DeviceModel device = new DeviceModel(invoice.publicKey);
                invoice.address = invoice.address.ToLower();

                if (invoice.address.Contains("\\r"))
                {
                    invoice.address = invoice.address.Replace("\\r", "");
                }
                if (invoice.address.Contains("\r"))
                {
                    invoice.address = invoice.address.Replace("\r", "");
                }

                //very funny, paxful
                if (invoice.address.StartsWith("lightning:")) invoice.address = invoice.address.Remove(0, "lightning:".Length);
                
                //very funny, cash app
                if (invoice.address.Contains("?lightning=")) invoice.address = invoice.address.Remove(0, invoice.address.IndexOf("?lightning=") + "?lightning=".Length);



                int amountRequested = 0;
                bool invoiceWithAmount = false;
                string currency = device.Currency;

                if (!device.Loaded)
                {
                    throw new Exception("Invalid device");
                }

                if (currency == null) currency = "USD";

                //amount as at current rate
                int amountValidated = ExchangeService.ConvertToSAT(currency, invoice.amountUSD);

                double amountComisionUSD = invoice.amountUSD * (100 - device.Commission) / 100;
                amountComisionUSD = Math.Round(amountComisionUSD, 2);

                double satComision = (double)amountValidated * (100 - device.Commission) / 100;
                amountValidated = (int)Math.Round(satComision);


                //Generate Lightning invoice from Lightning Address
                if (invoice.address.Contains("@"))
                {
                    invoice.address = LnurlService.GenerateInvoiceFromAddress(invoice.address, amountValidated);
                }
                if (invoice.address.StartsWith("lnurl"))
                {
                    invoice.address = LnurlService.GenerateInvoiceFromBech32(invoice.address, amountValidated);
                }
                
                //amount as requested by the user
                amountRequested = LightningService.DecodeAmount(invoice.address);
                invoiceWithAmount = true;
                if (amountRequested == 0) invoiceWithAmount = false;
                
                

                DatabaseQuery q = new DatabaseQuery();
                Bean tr = q.Dispense("Transaction");
                tr.Put("DeviceId", device.Id)
                    .Put("ServiceId", serviceId)
                    .Put("AmountUSD", invoice.amountUSD)
                    .Put("AmountBTC", amountValidated)
                    .Put("Commission", device.Commission)
                    .Put("Currency", currency)
                    .Put("ExchangeRate", Globals.GetExchangeRate(currency))
                    .Put("Address", invoice.address)
                    .Put("SignatureClient", signature)
                    .Put("SignatureServer", SecurityService.SignPayload(device.PrivateKey, serializedInput));

                int trId = int.Parse(q.Store(tr).ToString());


                if ((amountRequested > amountValidated * 1.02 || amountRequested < amountValidated * 0.98) && invoiceWithAmount)
                {
                    throw new Exception(string.Format("Please generate a new invoice for {0} Satoshis or {1} {2}", amountValidated, amountComisionUSD, currency));
                }
                if (amountRequested == 0) amountRequested = amountValidated;


                AccountModel account = new AccountModel(device.AccountId);

               //// OPEN NODE OVERRIDE
                ////////////////////////////////////////////////////
                //if (device.AccountId == 1) { serviceId = 1; }
                ///////////////////////////////////////////////////////
                ///

                q.Read("SELECT * FROM AccountExternalService WHERE AccountId = {0}", device.AccountId);

                if (q.ReadResult.Length != 1) 
                {
                    throw new Exception("Remote API not available");
                }
                string ApiTokenMerchant = q.ReadResult[0]["ApiToken"].ToString();
                string defaultWalletIdMerchant = q.ReadResult[0]["ApiSecret"].ToString();
                string merchantExtraData = Convert.ToString(q.ReadResult[0]["ExtraData"]);
                serviceId = int.Parse(q.ReadResult[0]["ExternalServiceId"].ToString());

                

                if (serviceId == 2)
                {
                    //prevent double payment in case the previous attempt was completed after we timed out
                    
                    //EBORJA TODO URGENT find out why v8 is not passing this test

                    /*q.Read("SELECT Id FROM [Transaction] WHERE ([Address] = '{0}' OR (DeviceId = {1} AND CreatedDate > (SELECT LastSeen FROM Device WHERE Id = {1}))) AND RemoteResponse like '%SUCCESS%'", invoice.address, deviceId);
                    if (q.ReadResult.Length > 0)
                    {

                        q.Exec("UPDATE [Transaction] SET RemoteResponse = 'REPEATED from TrId:{0}' WHERE Id = {1}", q.ReadResult[0]["Id"].ToString(), trId);
                        result.success = true;
                        result.message = "Payment completed successfully";
                        return Content(JsonConvert.SerializeObject(result));
                    }*/

                    //STEP 1
                    //CHECK Merchant's Wallet Balance

                    long merchantBalance = (long)GaloyService.QueryBalance(ApiTokenMerchant, defaultWalletIdMerchant, "BTC");


                    if (merchantBalance < amountValidated * 1.02)
                    {
                        throw new Exception("La wallet del cajero no puede cubrir el monto requerido. Contacte al operador. / Insufficient funds. Contact the operator.");
                    }


                    ///////////////////////////////////////////////////////////////////////////








                    //STEP 1.1
                    //Try to pay the user's invoice directly from the merchant's wallet

                    string memo1 = device.Name + ": TR#" + trId + ".1";
                    if (!memo1.StartsWith("K1")) memo1 = "K1 " + memo1;

                    string merchantBBWResponse1 = GaloyService.PayInvoice(invoice.address, amountRequested, ApiTokenMerchant, defaultWalletIdMerchant, memo1, invoiceWithAmount);

                    q.Exec("UPDATE [Transaction] SET RemoteResponse = '{0}' WHERE Id = {1}", merchantBBWResponse1, trId);
                    if (merchantBBWResponse1.Contains("SUCCESS") || merchantBBWResponse1.Contains("PENDING"))
                    {
                        result.success = true;
                        result.message = "Payment completed successfully";
                        return Content(JsonConvert.SerializeObject(result));
                    }
                    else

                    {
                        result.success = false;
                        result.message = "Please try with another wallet. Por favor intenta con otra billetera.";
                        return Content(JsonConvert.SerializeObject(result));
                    }



                }

                if (serviceId == 3) //Strike
                {
                    //prevent double payment in case the previous attempt was completed after we timed out
                    /*
                    q.Read("SELECT Id FROM [Transaction] WHERE ([Address] = '{0}' OR (DeviceId = {1} AND CreatedDate > (SELECT LastSeen FROM Device WHERE Id = {1}))) AND RemoteResponse like '%SUCCESS%'", invoice.address, deviceId);
                    if (q.ReadResult.Length > 0)
                    {

                        q.Exec("UPDATE [Transaction] SET RemoteResponse = 'REPEATED from TrId:{0}' WHERE Id = {1}", q.ReadResult[0]["Id"].ToString(), trId);
                        result.success = true;
                        result.message = "Payment completed successfully";
                        return Content(JsonConvert.SerializeObject(result));
                    }*/

                    //STEP 1
                    //CHECK Merchant's Wallet Balance

                    long merchantBalance = (long)StrikeService.QueryBalance(ApiTokenMerchant, "BTC", true);


                    if (merchantBalance < amountValidated * 1.02)
                    {
                        throw new Exception("La wallet del cajero no puede cubrir el monto requerido. Contacte al operador. / Insufficient funds. Contact the operator.");
                    }

                    ///////////////////////////////////////////////////////////////////








                    //STEP 1.1
                    //Try to pay the user's invoice directly from the merchant's wallet

                    string memo1 = device.Name + ": TR#" + trId + ".1";
                    if (!memo1.StartsWith("K1")) memo1 = "K1 " + memo1;

                    string merchantStrikeResponse1 = StrikeService.PayInvoice(invoice.address, ApiTokenMerchant, defaultWalletIdMerchant, amountRequested, invoiceWithAmount);

                    q.Exec("UPDATE [Transaction] SET RemoteResponse = '{0}' WHERE Id = {1}", merchantStrikeResponse1, trId);
                    if (merchantStrikeResponse1.Contains("SUCCESS") || merchantStrikeResponse1.Contains("PENDING"))
                    {
                        result.success = true;
                        result.message = "Payment completed successfully";
                        return Content(JsonConvert.SerializeObject(result));
                    }
                    else
                    {
                        result.success = false;
                        result.message = "Please try with another wallet. Por favor intenta con otra billetera.";
                        return Content(JsonConvert.SerializeObject(result));
                    }



                }



            }
            catch (Exception ex)
            {
                result.message = ex.Message;
                return Content(JsonConvert.SerializeObject(result));
            }


            return Content(JsonConvert.SerializeObject(result));
        }


        [HttpPost("Compatible")]
        public ContentResult PostCompatible([FromBody] InvoiceDTO invoice)
        {
            Response.Headers["content-type"] = "application/json";
            ResultDTO result = new ResultDTO { success = false };

            try
            {
                string signature = string.Empty;
                if (Request.Headers.ContainsKey("Signature")) signature = Request.Headers["Signature"];


                // 🔹 Store transaction in DB
                DeviceModel device;
                var (trId, validatedAmount) = TransactionService.ValidateAndStoreTransaction(invoice, signature, out device);

                // 🔹 Execute payment
                string paymentResponse = TransactionService.ExecutePayment(trId, device, invoice, validatedAmount);

                result.message = "Payment failed";
                if (paymentResponse.Contains("SUCCESS") || paymentResponse.Contains("PENDING"))
                {
                    result.success = true;
                    result.message = "Payment completed successfully";
                }
            }
            catch (Exception ex)
            {
                result.message = ex.Message;
            }

            return Content(JsonConvert.SerializeObject(result));
        }

        [HttpPost("Polling")]
        public ContentResult PostWithPolling([FromBody] InvoiceDTO invoice)
        {
            Response.Headers["content-type"] = "application/json";
            ResultDTO result = new ResultDTO { success = false };

            try
            {
                string signature = string.Empty;
                if (Request.Headers.ContainsKey("Signature")) signature = Request.Headers["Signature"];

                // 🔹 Store transaction in DB
                DeviceModel device;
                var (trId, validatedAmount) = TransactionService.ValidateAndStoreTransaction(invoice, signature, out device);

                // 🔹 Start payment asynchronously
                Task.Run(() =>
                {
                    try
                    {
                        string paymentResponse = TransactionService.ExecutePayment(trId, device, invoice, validatedAmount);
                        Console.WriteLine($"Payment for Transaction #{trId}: {paymentResponse}");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Payment Error for Transaction #{trId}: {ex.Message}");
                    }
                });



                // 🔹 Return transaction ID instead of processing immediately
                result.success = true;
                result.message = "Transaction created.";
                //result.data = new { transactionId = trId };
            }
            catch (Exception ex)
            {
                result.message = ex.Message;
            }

            return Content(JsonConvert.SerializeObject(result));
        }


    }
}
