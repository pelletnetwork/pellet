import { test, describe } from "node:test";
import assert from "node:assert";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PelletHlClient } from "../src/index";
import { CHAIN_CONFIG } from "../src/constants";

const publicClient = createPublicClient({ transport: http(CHAIN_CONFIG.mainnet.rpc) });

const pellet = new PelletHlClient({ publicClient });

describe("@pelletnetwork/hl — smoke", async () => {
  test("readAgent(1n) returns Pellet controller + metadata", async () => {
    const agent = await pellet.readAgent(1n);
    assert.strictEqual(agent.controller, "0x2cbd7730994D3Ee1aAc4B1d0F409b1b62d7C1834");
    assert.strictEqual(agent.metadataURI, "https://pellet.network/.well-known/agent.json");
    assert.ok(agent.registeredAt > 0n, "registeredAt is non-zero");
  });

  test("readReputation(1n) returns array (may be empty)", async () => {
    const reps = await pellet.readReputation(1n);
    assert.ok(Array.isArray(reps), "returns array");
  });

  test("readValidation(1n) returns array (may be empty)", async () => {
    const vals = await pellet.readValidation(1n);
    assert.ok(Array.isArray(vals), "returns array");
  });

  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey || privateKey === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    test.skip("write ops — PRIVATE_KEY not set", () => {});
  } else {
    const account = privateKeyToAccount(privateKey);
    const walletClient = createWalletClient({ account, transport: http(CHAIN_CONFIG.testnet.rpc) });
    const testnetPublic = createPublicClient({ transport: http(CHAIN_CONFIG.testnet.rpc) });
    const testnetPellet = new PelletHlClient({
      publicClient: testnetPublic,
      walletClient,
      chain: "testnet",
    });

    test("mintAgentId on testnet", async () => {
      const { agentId, txHash } = await testnetPellet.mintAgentId({ metadataURI: "ipfs://smoke-test-agent" });
      assert.ok(agentId > 0n, "agentId > 0");
      assert.ok(txHash.startsWith("0x"), "txHash is hex");
    });

    test("postAttestation on testnet", async () => {
      const { attestationId, txHash } = await testnetPellet.postAttestation({
        agentId: 1n,
        attestationType: "0x0000000000000000000000000000000000000000000000000000000000000001",
        score: 100n,
        metadataURI: "ipfs://smoke-attestation",
      });
      assert.ok(attestationId > 0n, "attestationId > 0");
      assert.ok(txHash.startsWith("0x"), "txHash is hex");
    });

    test("postValidation on testnet", async () => {
      const { validationId, txHash } = await testnetPellet.postValidation({
        agentId: 1n,
        claimHash: "0x0000000000000000000000000000000000000000000000000000000000000002",
        proofURI: "ipfs://smoke-validation",
      });
      assert.ok(validationId > 0n, "validationId > 0");
      assert.ok(txHash.startsWith("0x"), "txHash is hex");
    });
  }
});
