# K1 Starknet Adapter

I want to build a nodejs backend in typescript to handle an atomic swap between Starknet and Lightning.
The service will be stateless and receive all info from another backend.

K1 has an existing backend that works with Lightning only, this backend will call our Rest post endpoint to initiate the atomic swap between Starknet and Lightning.
You can find the core logic of the K1 backend in .cursor/InvoiceController.cs

Use this for Atomiq SDK:
"@atomiqlabs/chain-starknet": "^3.0.0-beta.8",
    "@atomiqlabs/sdk": "^4.0.1",
    "@atomiqlabs/storage-sqlite": "^1.0.0",

You can find how to perform the atomic swap using Atomiq SDK in .cursor/atomic-swap-sample.ts

Initialise and build the nodejs backend with a REST endpoint to trigger the atomic swap.

I provided the required env variables in .env file.

