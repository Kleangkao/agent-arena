 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./ArenaRules.sol";

/// @notice Application-specific immutable identity and outcome registry.
/// The operator attests to transcript provenance. The contract checks rules and outcome.
contract ArenaSettlement is ArenaRules {
    address public immutable operator = msg.sender;
    uint8 public constant RULES_VERSION = 1;
    uint8 public constant MAP_VERSION = 1;

    struct MatchRecord {
        address blue;
        address sand;
        bytes32 configuration;
        bytes32 transcriptHash;
        uint8 result;
    }

    mapping(address => bool) public registered;
    mapping(bytes32 => MatchRecord) public matches;
    event Registered(address indexed owner);
    event Created(bytes32 indexed id, address indexed blue, address indexed sand, bytes32 configuration);
    event Finalized(bytes32 indexed id, uint8 result, bytes32 transcriptHash);

    function register() external {
        require(!registered[msg.sender], "registered");
        registered[msg.sender] = true;
        emit Registered(msg.sender);
    }

    // The blue owner authorizes a specific competition against the operator's registered agent.
    function createMatch(bytes32 id, bytes32 configuration, uint8 rules, uint8 map) external {
        require(registered[msg.sender] && registered[operator] && msg.sender != operator, "participants");
        require(id != bytes32(0) && configuration != bytes32(0) && matches[id].blue == address(0), "match");
        require(rules == RULES_VERSION && map == MAP_VERSION, "version");
        matches[id] = MatchRecord(msg.sender, operator, configuration, bytes32(0), 0);
        emit Created(id, msg.sender, operator, configuration);
    }

    function settle(bytes32 id, bytes32 configuration, uint8[2][] calldata actions) external {
        require(msg.sender == operator, "operator");
        MatchRecord storage matchRecord = matches[id];
        require(matchRecord.blue != address(0) && matchRecord.result == 0, "match unavailable");
        require(matchRecord.configuration == configuration, "configuration");
        uint8 result = simulate(actions).result;
        bytes32 transcriptHash = keccak256(abi.encode(actions));
        matchRecord.result = result;
        matchRecord.transcriptHash = transcriptHash;
        emit Finalized(id, result, transcriptHash);
    }
}
