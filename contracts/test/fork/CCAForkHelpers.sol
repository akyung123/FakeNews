// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {
    AuctionParameters,
    ICca,
    ICcaFactory,
    IInitializerHookView,
    ILbpStrategy,
    LiquidityAllocationBracket,
    MigratorParameters,
    PoolParameters,
    PositionDefinition
} from "./CCAForkInterfaces.sol";
import {CCAForkToken} from "./CCAForkToken.sol";

/// Official Sepolia Liquidity Launchpad + CCA v2.1.0 addresses
/// (developers.uniswap.org / docs/liquidity/liquidity-launchpad/deployments).
address constant CCA_FACTORY = 0x000000001F26a0044BaA66024e7b6599c61963F8;
address constant LBP_STRATEGY = 0x95434E898Af471945Cab33D5064d2aC1A6Ba2000;
address constant INITIALIZER_HOOK = 0x1600059B95A80d500fC42400ea9a88A9C29D2000;
address constant SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
address constant SEPOLIA_POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;

/// Recent Sepolia block where factory, LBPStrategy, and InitializerHook have code.
/// 0xb3d300 = 11_784_960 (checked 2026-09-26; ~40 blocks behind then-head 0xb3d329).
uint256 constant CCA_FORK_BLOCK = 11_784_960;
string constant PUBLIC_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

uint24 constant MPS = 10_000_000;
uint256 constant Q96 = 1 << 96;
/// Official CCA test floor / tick (AuctionBaseTest): 1000 and 100 in Q96.
uint256 constant CCA_FLOOR_PRICE = 1000 * Q96;
uint256 constant CCA_TICK_SPACING = 100 * Q96;
uint128 constant GRADUATION_THRESHOLD = 0.02 ether;
uint128 constant AUCTION_SUPPLY = 800e18;
uint128 constant LP_RESERVE = 200e18;
uint128 constant TOKEN_SUPPLY = AUCTION_SUPPLY + LP_RESERVE;
uint24 constant V4_FEE = 10_000;
int24 constant V4_TICK_SPACING = 200;
uint64 constant DEFAULT_AUCTION_BLOCKS = 25;

/// Shared encoding + fork harness. Does not touch Launchpad.
abstract contract CCAForkBase is Test {
    ICcaFactory internal factory = ICcaFactory(CCA_FACTORY);
    ILbpStrategy internal strategy = ILbpStrategy(LBP_STRATEGY);

    address internal protocol = address(0xFEE);
    address internal lpRecipient = address(0x1b);
    address internal bidderA = address(0xA11);
    address internal bidderB = address(0xB0B);

    bool internal forked;
    uint256 internal forkBlock;

    receive() external payable {}

    function _rpcUrl() internal view returns (string memory) {
        return vm.envOr("SEPOLIA_RPC_URL", PUBLIC_SEPOLIA_RPC);
    }

    function _pinBlock() internal view returns (uint256) {
        return vm.envOr("SEPOLIA_FORK_BLOCK", CCA_FORK_BLOCK);
    }

    function _forkAt(string memory rpc, uint256 pin) external {
        vm.createSelectFork(rpc, pin);
    }

    /// Pin a recent Sepolia block. RPC is the Actions secret when set, else publicnode.
    function _maybeFork() internal returns (bool) {
        string memory rpc = _rpcUrl();
        uint256 pin = _pinBlock();
        try this._forkAt(rpc, pin) {
            forked = true;
            forkBlock = pin;
        } catch {
            return false;
        }
        if (CCA_FACTORY.code.length == 0 || LBP_STRATEGY.code.length == 0 || INITIALIZER_HOOK.code.length == 0) {
            forked = false;
            return false;
        }
        return true;
    }

    modifier onFork() {
        if (!forked) vm.skip(true);
        _;
    }

    /// One packed step: `uint24 mps | uint40 blockDelta`. Uniform issuance requires
    /// `mps * auctionBlocks == 1e7` (CCA StepStorage: sum of mps×delta, not sum of mps).
    function packUniformSteps(uint64 auctionBlocks) internal pure returns (bytes memory steps) {
        if (auctionBlocks == 0 || MPS % uint256(auctionBlocks) != 0) revert("auctionBlocks must divide 1e7");
        uint24 mps = uint24(uint256(MPS) / uint256(auctionBlocks));
        return abi.encodePacked(mps, uint40(auctionBlocks));
    }

    /// `migrationBlock` is strictly after `endBlock` (LBPStrategy.InvalidEndBlock).
    function migrationBlockAfter(uint64 endBlock) internal pure returns (uint64) {
        return endBlock + 1;
    }

    function _auctionWindows(uint64 auctionBlocks)
        internal
        view
        returns (uint64 startBlock, uint64 endBlock, uint64 claimBlock, uint64 migrationBlock)
    {
        startBlock = uint64(block.number);
        endBlock = startBlock + auctionBlocks;
        claimBlock = endBlock;
        migrationBlock = migrationBlockAfter(endBlock);
    }

    function encodeAuctionParams(uint64 auctionBlocks, address tokensRecipient)
        internal
        view
        returns (AuctionParameters memory p, uint64 migrationBlock)
    {
        (uint64 startBlock, uint64 endBlock, uint64 claimBlock, uint64 mig) = _auctionWindows(auctionBlocks);
        migrationBlock = mig;
        p = AuctionParameters({
            currency: address(0),
            tokensRecipient: tokensRecipient,
            fundsRecipient: LBP_STRATEGY,
            startBlock: startBlock,
            endBlock: endBlock,
            claimBlock: claimBlock,
            tickSpacing: CCA_TICK_SPACING,
            validationHook: address(0),
            floorPrice: CCA_FLOOR_PRICE,
            requiredCurrencyRaised: GRADUATION_THRESHOLD,
            auctionStepsData: packUniformSteps(auctionBlocks)
        });
    }

    function encodeMigratorParams(address token, uint64 migrationBlock)
        internal
        view
        returns (MigratorParameters memory mp)
    {
        LiquidityAllocationBracket[] memory brackets = new LiquidityAllocationBracket[](1);
        brackets[0] = LiquidityAllocationBracket({lowerThreshold: 0, rate: MPS});
        mp = MigratorParameters({
            token: token,
            currency: address(0),
            migrationBlock: migrationBlock,
            reservedTokenAmountForLP: LP_RESERVE,
            recipient: protocol,
            positionRecipient: lpRecipient,
            poolParameters: PoolParameters({fee: V4_FEE, tickSpacing: V4_TICK_SPACING, hook: INITIALIZER_HOOK}),
            positionDefinitions: abi.encode(new PositionDefinition[](0)),
            lpAllocationSchedule: abi.encode(brackets)
        });
    }

    function encodeConfigData(address token, uint64 auctionBlocks)
        internal
        view
        returns (bytes memory configData, AuctionParameters memory auction, MigratorParameters memory mp)
    {
        uint64 migrationBlock;
        (auction, migrationBlock) = encodeAuctionParams(auctionBlocks, protocol);
        mp = encodeMigratorParams(token, migrationBlock);
        configData = abi.encode(mp, abi.encode(auction));
    }

    function _mintAndApprove(string memory label) internal returns (CCAForkToken token) {
        token = new CCAForkToken(label, "CCA", TOKEN_SUPPLY, address(this));
        token.approve(LBP_STRATEGY, TOKEN_SUPPLY);
    }

    function _predictAuction(address token, bytes memory configData, bytes32 salt)
        internal
        view
        returns (address auction)
    {
        (MigratorParameters memory mp, bytes memory initializerParams) =
            abi.decode(configData, (MigratorParameters, bytes));
        bytes32 initializerSalt = keccak256(abi.encode(salt, mp));
        auction = factory.getAddress(token, AUCTION_SUPPLY, initializerParams, initializerSalt, LBP_STRATEGY);
    }

    function _createAuction(uint64 auctionBlocks, string memory label)
        internal
        returns (ICca auction, CCAForkToken token, bytes32 salt)
    {
        token = _mintAndApprove(label);
        (bytes memory configData,,) = encodeConfigData(address(token), auctionBlocks);
        salt = keccak256(abi.encodePacked("prophecy-cca-fork", label, auctionBlocks, block.number));
        address predicted = _predictAuction(address(token), configData, salt);

        vm.recordLogs();
        strategy.initializeDistribution(address(token), TOKEN_SUPPLY, configData, salt);

        auction = ICca(predicted);
        assertTrue(address(auction).code.length > 0, "auction missing code");
        assertEq(auction.token(), address(token));
        assertEq(auction.currency(), address(0));
        assertEq(auction.fundsRecipient(), LBP_STRATEGY);
        assertEq(auction.tokensRecipient(), protocol);
        assertEq(auction.totalSupply(), AUCTION_SUPPLY);
        assertEq(token.balanceOf(address(auction)), AUCTION_SUPPLY);
        assertEq(token.balanceOf(LBP_STRATEGY), LP_RESERVE);
        assertEq(uint256(auction.endBlock() - auction.startBlock()), uint256(auctionBlocks));
        assertEq(uint256(auction.claimBlock()), uint256(auction.endBlock()));
    }

    function _bid(ICca auction, address owner, uint128 amount, uint256 ticksAboveFloor) internal returns (uint256 bidId) {
        uint256 maxPrice = CCA_FLOOR_PRICE + ticksAboveFloor * CCA_TICK_SPACING;
        uint256 prevTick = CCA_FLOOR_PRICE + (ticksAboveFloor - 1) * CCA_TICK_SPACING;
        vm.deal(owner, amount + 1 ether);
        vm.prank(owner);
        bidId = auction.submitBid{value: amount}(maxPrice, amount, owner, prevTick, "");
        assertGt(bidId, 0);
    }

    function _rollTo(uint64 target) internal {
        if (block.number < target) vm.roll(target);
    }
}
