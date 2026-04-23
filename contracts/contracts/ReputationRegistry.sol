// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

//0xCDbCE1D9aB3d95DaC06Dec7C8Da814944fE10F86
contract ReputationRegistry {

    struct AgentProfile {
        address agent;
        string passportDID;
        uint256 jobsCompleted;
        uint256 totalEarned;     // in USDC (6 decimals)
        uint256 reputationScore; // starts at 100
        bool registered;
    }

    mapping(address => AgentProfile) public profiles;
    mapping(string => address) public didToAddress;

    address public escrowContract;
    address public owner;

    event AgentRegistered(address indexed agent, string passportDID);
    event ReputationUpdated(address indexed agent, uint256 newScore, uint256 jobsCompleted);

    modifier onlyEscrow() {
        require(msg.sender == escrowContract, "Only escrow contract");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setEscrowContract(address _escrow) external onlyOwner {
        escrowContract = _escrow;
    }

    function registerAgent(string calldata passportDID) external {
        require(!profiles[msg.sender].registered, "Already registered");
        require(didToAddress[passportDID] == address(0), "DID already used");

        profiles[msg.sender] = AgentProfile({
            agent: msg.sender,
            passportDID: passportDID,
            jobsCompleted: 0,
            totalEarned: 0,
            reputationScore: 100,
            registered: true
        });

        didToAddress[passportDID] = msg.sender;

        emit AgentRegistered(msg.sender, passportDID);
    }

    function recordCompletion(address agent, uint256 amountEarned) external {
    require(
        msg.sender == escrowContract || msg.sender == owner,
        "Not authorized"
    );
    require(profiles[agent].registered, "Agent not registered");

    AgentProfile storage profile = profiles[agent];
    profile.jobsCompleted += 1;
    profile.totalEarned += amountEarned;
    profile.reputationScore += 10;

    emit ReputationUpdated(agent, profile.reputationScore, profile.jobsCompleted);
}

    function getProfile(address agent) external view returns (AgentProfile memory) {
        return profiles[agent];
    }

    function getProfileByDID(string calldata did) external view returns (AgentProfile memory) {
        address agent = didToAddress[did];
        require(agent != address(0), "DID not found");
        return profiles[agent];
    }
}