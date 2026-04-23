// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
// 0xe1b1a7cb7C0D3bb12ACB7a725eD60D8d393eF788
contract JobBoard {
    error NotTheClient();
    error JobDoesNotExist();
    error JobNotOpen();
    error ClientCannotBid();
    error NotInProgress();
    error FreelancerNotAssigned();

    enum JobStatus { Open, Assigned, Completed, Cancelled }

    struct Job {
        uint256 id;
        address client;
        string title;
        string description;
        uint256 bounty;        // in USDC (6 decimals)
        JobStatus status;
        address assignedTo;
        uint256 createdAt;
        uint256 deadline;
    }

    struct Bid {
        address bidder;
        uint256 price;
        string proposal;
        uint256 submittedAt;
    }

    uint256 public jobCounter;

    mapping(uint256 => Job) public jobs;
    mapping(uint256 => Bid[]) public bids;
    mapping(uint256 => string) public deliverables;

    event JobPosted(uint256 indexed jobId, address indexed client, string title, uint256 bounty);
    event BidSubmitted(uint256 indexed jobId, address indexed bidder, uint256 price);
    event JobAssigned(uint256 indexed jobId, address indexed freelancer);
    event DeliverableSubmitted(uint256 indexed jobId, address indexed freelancer, string deliverable);
    event JobCompleted(uint256 indexed jobId);

    modifier onlyClient(uint256 jobId) {
        require(msg.sender == jobs[jobId].client, NotTheClient());
        _;
    }

    modifier jobExists(uint256 jobId) {
        require(jobId < jobCounter, JobDoesNotExist());
        _;
    }

    function postJob(string calldata title, string calldata description, uint256 bounty, uint256 deadline) external returns (uint256) {
        uint256 jobId = jobCounter++;

        jobs[jobId] = Job({
            id: jobId,
            client: msg.sender,
            title: title,
            description: description,
            bounty: bounty,
            status: JobStatus.Open,
            assignedTo: address(0),
            createdAt: block.timestamp,
            deadline: deadline
        });

        emit JobPosted(jobId, msg.sender, title, bounty);
        return jobId;
    }

    function submitBid(
        uint256 jobId,
        uint256 price,
        string calldata proposal
    ) external jobExists(jobId) {
        require(jobs[jobId].status == JobStatus.Open, JobNotOpen());
        require(msg.sender != jobs[jobId].client, ClientCannotBid());

        bids[jobId].push(Bid({
            bidder: msg.sender,
            price: price,
            proposal: proposal,
            submittedAt: block.timestamp
        }));

        emit BidSubmitted(jobId, msg.sender, price);
    }

    function assignJob(
        uint256 jobId,
        address freelancer
    ) external jobExists(jobId) onlyClient(jobId) {
        require(jobs[jobId].status == JobStatus.Open, JobNotOpen());

        jobs[jobId].status = JobStatus.Assigned;
        jobs[jobId].assignedTo = freelancer;

        emit JobAssigned(jobId, freelancer);
    }

    function submitDeliverable(
        uint256 jobId,
        string calldata deliverable
    ) external jobExists(jobId) {
        require(jobs[jobId].assignedTo == msg.sender, FreelancerNotAssigned());
        require(jobs[jobId].status == JobStatus.Assigned, NotInProgress());

        deliverables[jobId] = deliverable;

        emit DeliverableSubmitted(jobId, msg.sender, deliverable);
    }

    function markCompleted(uint256 jobId) external jobExists(jobId) onlyClient(jobId) {
        require(jobs[jobId].status == JobStatus.Assigned, NotInProgress());
        jobs[jobId].status = JobStatus.Completed;
        emit JobCompleted(jobId);
    }

    function getBids(uint256 jobId) external view returns (Bid[] memory) {
        return bids[jobId];
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function getDeliverable(uint256 jobId) external view returns (string memory) {
        return deliverables[jobId];
    }
}