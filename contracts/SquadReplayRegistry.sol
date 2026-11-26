// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Records the Arena operator's replay commitment for a match.
/// Gameplay validity, the outcome, and model provenance are checked off-chain.
contract SquadReplayRegistry {
    address public immutable operator = msg.sender;

    struct Record {
        bytes32 replayHash;
        uint64 blockNumber;
    }

    mapping(bytes32 => Record) public records;
    event ReplayRecorded(bytes32 indexed matchKey, bytes32 indexed replayHash);

    function recordReplay(bytes32 matchKey, bytes32 replayHash) external {
        require(msg.sender == operator, "operator");
        require(matchKey != bytes32(0) && replayHash != bytes32(0), "empty commitment");
        require(records[matchKey].replayHash == bytes32(0), "already recorded");
        records[matchKey] = Record(replayHash, uint64(block.number));
        emit ReplayRecorded(matchKey, replayHash);
    }
}
