// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract Escrow {

    enum EscrowStatus { Funded, Released, Refunded }

    struct EscrowRecord {
        uint256 jobId;
        address client;
        address freelancer;
        uint256 amount;
        EscrowStatus status;
        address usdcToken;
    }

    mapping(uint256 => EscrowRecord) public escrows;

    address public verifier;
    address public owner;

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

    constructor(address _verifier) {
        verifier = _verifier;
        owner = msg.sender;
    }

    function setVerifier(address _verifier) external onlyOwner {
        verifier = _verifier;
    }

    function fundEscrow(
        uint256 jobId,
        address freelancer,
        uint256 amount,
        address usdcToken
    ) external {
        require(escrows[jobId].client == address(0), "Escrow already exists");
        require(amount > 0, "Amount must be greater than 0");

        bool success = IERC20(usdcToken).transferFrom(msg.sender, address(this), amount);
        require(success, "USDC transfer failed");

        escrows[jobId] = EscrowRecord({
            jobId: jobId,
            client: msg.sender,
            freelancer: freelancer,
            amount: amount,
            status: EscrowStatus.Funded,
            usdcToken: usdcToken
        });

        emit EscrowFunded(jobId, msg.sender, amount);
    }

    function releaseEscrow(uint256 jobId) external onlyVerifier {
        EscrowRecord storage record = escrows[jobId];
        require(record.status == EscrowStatus.Funded, "Escrow not funded");

        record.status = EscrowStatus.Released;

        bool success = IERC20(record.usdcToken).transfer(record.freelancer, record.amount);
        require(success, "USDC release failed");

        emit EscrowReleased(jobId, record.freelancer, record.amount);
    }

    function refundEscrow(uint256 jobId) external {
        EscrowRecord storage record = escrows[jobId];
        require(msg.sender == record.client, "Only client can refund");
        require(record.status == EscrowStatus.Funded, "Escrow not funded");

        record.status = EscrowStatus.Refunded;

        bool success = IERC20(record.usdcToken).transfer(record.client, record.amount);
        require(success, "USDC refund failed");

        emit EscrowRefunded(jobId, record.client, record.amount);
    }

    function getEscrow(uint256 jobId) external view returns (EscrowRecord memory) {
        return escrows[jobId];
    }
}