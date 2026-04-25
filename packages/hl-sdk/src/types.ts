import type { Address, Hex } from "viem";

export type HlChain = "mainnet";

export type AgentRecord = {
  controller: Address;
  registeredAt: bigint;
  metadataURI: string;
};

export type AttestationRecord = {
  agentId: bigint;
  attester: Address;
  timestamp: bigint;
  attestationType: Hex;
  score: bigint;
  metadataURI: string;
};

export type ValidationRecord = {
  agentId: bigint;
  validator: Address;
  timestamp: bigint;
  claimHash: Hex;
  proofURI: string;
};

export type MintAgentResult = { agentId: bigint; txHash: Hex };
export type PostAttestationResult = { attestationId: bigint; txHash: Hex };
export type PostValidationResult = { validationId: bigint; txHash: Hex };
