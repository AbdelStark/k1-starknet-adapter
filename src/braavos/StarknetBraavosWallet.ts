import {
  Account,
  CallData,
  DeployAccountContractPayload,
  ec,
  hash,
  Provider,
} from "starknet";
import { toHex } from "../Utils";
import { Buffer } from "buffer";
import { BraavosBaseClassHash, calculateAddressBraavos } from "./deployBraavos";

//Braavos Account wallet
export class StarknetBraavosWallet extends Account {
  public readonly publicKey: string;

  constructor(provider: Provider, privateKey: string, accountAddress?: string) {
    const hexPrivateKey = toHex(privateKey);
    if (!hexPrivateKey) {
      throw new Error("Invalid private key provided");
    }
    const publicKey = ec.starkCurve.getStarkKey(hexPrivateKey);
    // Use provided address if available, otherwise calculate it
    const BraavoscontractAddress = accountAddress || calculateAddressBraavos(hexPrivateKey);
    super(provider, BraavoscontractAddress, hexPrivateKey, "1");
    this.publicKey = publicKey;
  }

  public getDeploymentData(): DeployAccountContractPayload {
    return {
      classHash: BraavosBaseClassHash,
      constructorCalldata: CallData.compile({ public_key: this.publicKey }),
      addressSalt: this.publicKey,
      contractAddress: this.address,
    };
  }

  public static generateRandomPrivateKey(): string {
    return (
      "0x" + Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex")
    );
  }
}