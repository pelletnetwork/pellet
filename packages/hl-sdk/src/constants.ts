import type { Address } from "viem";

const IDENTITY_ABI = [
  {
    type: "function",
    name: "registerAgent",
    inputs: [{ name: "metadataURI", type: "string", internalType: "string" }],
    outputs: [{ name: "agentId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAgent",
    inputs: [{ name: "agentId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "tuple", internalType: "struct IdentityRegistry.Agent", components: [
      { name: "controller", type: "address", internalType: "address" },
      { name: "registeredAt", type: "uint64", internalType: "uint64" },
      { name: "metadataURI", type: "string", internalType: "string" },
    ]}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "controllerOf",
    inputs: [{ name: "agentId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "controller", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "controller", type: "address", indexed: true, internalType: "address" },
      { name: "metadataURI", type: "string", indexed: false, internalType: "string" },
      { name: "timestamp", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
] as const;

const REPUTATION_ABI = [
  {
    type: "function",
    name: "postAttestation",
    inputs: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
      { name: "attestationType", type: "bytes32", internalType: "bytes32" },
      { name: "score", type: "int256", internalType: "int256" },
      { name: "metadataURI", type: "string", internalType: "string" },
    ],
    outputs: [{ name: "attestationId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAttestation",
    inputs: [{ name: "attestationId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "tuple", internalType: "struct ReputationRegistry.Attestation", components: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
      { name: "attester", type: "address", internalType: "address" },
      { name: "timestamp", type: "uint64", internalType: "uint64" },
      { name: "attestationType", type: "bytes32", internalType: "bytes32" },
      { name: "score", type: "int256", internalType: "int256" },
      { name: "metadataURI", type: "string", internalType: "string" },
    ]}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "attestationCountForAgent",
    inputs: [{ name: "agentId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "count", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "attestationsByAgent",
    inputs: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
      { name: "", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

const VALIDATION_ABI = [
  {
    type: "function",
    name: "postValidation",
    inputs: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
      { name: "claimHash", type: "bytes32", internalType: "bytes32" },
      { name: "proofURI", type: "string", internalType: "string" },
    ],
    outputs: [{ name: "validationId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getValidation",
    inputs: [{ name: "validationId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "tuple", internalType: "struct ValidationRegistry.Validation", components: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
      { name: "validator", type: "address", internalType: "address" },
      { name: "timestamp", type: "uint64", internalType: "uint64" },
      { name: "claimHash", type: "bytes32", internalType: "bytes32" },
      { name: "proofURI", type: "string", internalType: "string" },
    ]}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "validationCountForAgent",
    inputs: [{ name: "agentId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "count", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "validationsByAgent",
    inputs: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
      { name: "", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const CHAIN_CONFIG = {
  mainnet: {
    id: 999,
    name: "HyperEVM Mainnet",
    rpc: "https://rpc.hyperliquid.xyz/evm",
    explorer: "https://www.hyperscan.com",
  },
} as const;

export const CONTRACTS = {
  identity: "0x2bfcb081c8c5F98261efcdEC3971D0b1bc7ad943" as Address,
  reputation: "0x8cA1f4E2335271f12E5E14Cd8378B558fd14114b" as Address,
  validation: "0x7c44Dc7Fb45D723455DB1b69EE08Bd718998e5B4" as Address,
};

export { IDENTITY_ABI, REPUTATION_ABI, VALIDATION_ABI };
