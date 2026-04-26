// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IReputationRegistry {
    function recordCompletion(address agent, uint256 amountEarned) external;
}

contract Escrow {

    enum EscrowStatus { Funded, Released, Refunded }

    struct EscrowRecord {
        uint256 jobId;
        address client;
        address freelancer;
        uint256 amount;
        EscrowStatus status;
    }

    mapping(uint256 => EscrowRecord) public escrows;

    address public verifier;
    address public owner;
    address public reputationRegistry;

    event EscrowFunded(uint256 indexed jobId, address indexed client, uint256 amount);
    event EscrowReleased(uint256 indexed jobId, address indexed freelancer, uint256 amount);
    event EscrowRefunded(uint256 indexed jobId, address indexed client, uint256 amount);

    modifier onlyVerifier() {
        require(msg.sender == verifier, "Only verifier can release");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _verifier, address _reputationRegistry) {
        verifier = _verifier;
        owner = msg.sender;
        reputationRegistry = _reputationRegistry;
    }

    function setVerifier(address _verifier) external onlyOwner {
        verifier = _verifier;
    }

    function setReputationRegistry(address _registry) external onlyOwner {
        reputationRegistry = _registry;
    }

    // Client sends native token directly with this call
    function fundEscrow(
        uint256 jobId,
        address freelancer
    ) external payable {
        require(escrows[jobId].client == address(0), "Escrow already exists");
        require(msg.value > 0, "Must send native token");

        escrows[jobId] = EscrowRecord({
            jobId: jobId,
            client: msg.sender,
            freelancer: freelancer,
            amount: msg.value,
            status: EscrowStatus.Funded
        });

        emit EscrowFunded(jobId, msg.sender, msg.value);
    }

    function releaseEscrow(uint256 jobId) external onlyVerifier {
        EscrowRecord storage record = escrows[jobId];
        require(record.status == EscrowStatus.Funded, "Escrow not funded");

        record.status = EscrowStatus.Released;

        (bool success, ) = payable(record.freelancer).call{value: record.amount}("");
        require(success, "Native token transfer failed");

        if (reputationRegistry != address(0)) {
            IReputationRegistry(reputationRegistry).recordCompletion(
                record.freelancer,
                record.amount
            );
        }

        emit EscrowReleased(jobId, record.freelancer, record.amount);
    }

    function refundEscrow(uint256 jobId) external {
        EscrowRecord storage record = escrows[jobId];
        require(msg.sender == record.client, "Only client can refund");
        require(record.status == EscrowStatus.Funded, "Escrow not funded");

        record.status = EscrowStatus.Refunded;

        (bool success, ) = payable(record.client).call{value: record.amount}("");
        require(success, "Native token refund failed");

        emit EscrowRefunded(jobId, record.client, record.amount);
    }

    function getEscrow(uint256 jobId) external view returns (EscrowRecord memory) {
        return escrows[jobId];
    }

    // Allow contract to receive native token
    receive() external payable {}
}