// npx hardhat test test/notZK4.test.ts

import { expect } from "chai";
import { ethers } from "hardhat";
import { TimeUtils } from "./utils/helper";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import * as hre from "hardhat";
import lpTokenABI from "../abi/contracts/multipool/LPToken.sol/LPToken.json";
import pairABI from "../abi/contracts/Pair.sol/Pair.json";
import gaugeABI from "../abi/contracts/Gauge.sol/Gauge.json";
import ibribeABI from "../abi/contracts/InternalBribe.sol/InternalBribe.json";

import { BigNumber, Signer } from "ethers";
import { inputFile } from "hardhat/internal/core/params/argumentTypes";

const MAX_UINT256 = ethers.constants.MaxUint256;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const WEEK = 60 * 60 * 24 * 7;

describe("Swap", function () {
  this.timeout(60000);
  let swap: any;
  let WETH: any;
  let PairFactory: any;
  let pair: any;
  let pair2: any;
  let veArtProxy: any;
  let veStrat: any;
  let strat: any;
  let GaugeFactory: any;
  let BribeFactory: any;
  let WxBribeFactory: any;
  let Voter: any;
  let Minter: any;
  let MetaBribe: any;
  let RewardsDistributor: any;
  let minter: any;
  let router: any;
  let gauge: any;
  let gauge2: any;
  let internal_bribe: any;
  let internal_bribe2: any;
  let external_bribe: any;
  let external_bribe2: any;
  let wx_bribe: any;
  let wx_bribe2: any;
  let firstToken: any;
  let secondToken: any;
  let thirdToken: any;
  let scamToken: any;
  let swapToken: any;
  let deployer: any;
  let owner: any;
  let user1: any;
  let user2: any;
  let user3: any;
  let user4: any;
  let user5: any;
  let swapStorage: {
    initialA: BigNumber;
    futureA: BigNumber;
    initialATime: BigNumber;
    futureATime: BigNumber;
    swapFee: BigNumber;
    adminFee: BigNumber;
    lpToken: string;
  };

  // Test Values
  const INITIAL_A_VALUE = 500;
  const SWAP_FEE = 1e8;
  const LP_TOKEN_NAME = "Test LP Token Name";
  const LP_TOKEN_SYMBOL = "TESTLP";

  before(async () => {
    [owner, user1, user2, user3, user4, user5] = await ethers.getSigners();
    const FUNToken = await ethers.getContractFactory("FaucetERC20");
    firstToken = await FUNToken.deploy("UST", "UST", 0);
    await firstToken.mint(owner.address, BigInt(10000e18));
    await firstToken.mint(user1.address, BigInt(10000e18));
    await firstToken.mint(user2.address, BigInt(10000e18));
    const ZZZToken = await ethers.getContractFactory("FaucetERC20");
    secondToken = await ZZZToken.deploy("LUSD", "LUSD", 0);
    await secondToken.mint(owner.address, BigInt(10000e18));
    await secondToken.mint(user1.address, BigInt(10000e18));
    await secondToken.mint(user2.address, BigInt(10000e18));
    const LUSDToken = await ethers.getContractFactory("FaucetERC20");
    thirdToken = await LUSDToken.deploy("DAI", "DAI", 0);
    await thirdToken.mint(owner.address, BigInt(10000e18));
    await thirdToken.mint(user1.address, BigInt(10000e18));
    await thirdToken.mint(user2.address, BigInt(10000e18));
    scamToken = await LUSDToken.deploy("SCAM", "SCAM", 0);
    await scamToken.mint(owner.address, BigInt(10000e18));

    const weth = await ethers.getContractFactory("WETH");
    WETH = await weth.deploy();
    await WETH.deployed();

    const Factory = await ethers.getContractFactory("PairFactory");
    PairFactory = await Factory.deploy();
    await PairFactory.deployed();

    const amp = await ethers.getContractFactory("AmplificationUtils");
    const AmplificationUtils = await amp.deploy();
    await AmplificationUtils.deployed();
    const swaputils = await ethers.getContractFactory("SwapUtils");
    const SwapUtils = await swaputils.deploy();
    await SwapUtils.deployed();

    const Swap = await ethers.getContractFactory("Swap", {
      libraries: {
        AmplificationUtils: AmplificationUtils.address,
        SwapUtils: SwapUtils.address,
      },
    });

    swap = await Swap.deploy(
      [firstToken.address, secondToken.address, thirdToken.address],
      [18, 18, 18],
      LP_TOKEN_NAME,
      LP_TOKEN_SYMBOL,
      INITIAL_A_VALUE,
      SWAP_FEE,
      10 ** 10
    );
    swapStorage = await swap.swapStorage();
    const SwapToken = await ethers.getContractFactory("LPToken");
    swapToken = await SwapToken.attach(swapStorage.lpToken);

    let tx = await PairFactory.create3Pool(swap.address);
    await tx.wait();

    const Router = await ethers.getContractFactory("Router");
    router = await Router.deploy(PairFactory.address, WETH.address);

    await firstToken.connect(user2).approve(router.address, MAX_UINT256);
    await secondToken.connect(user2).approve(router.address, MAX_UINT256);

    tx = await router
      .connect(user2)
      .addLiquidity(
        firstToken.address,
        secondToken.address,
        true,
        BigInt(1000e18),
        BigInt(1000e18),
        0,
        0,
        user2.address,
        Date.now()
      );
    await tx.wait();

    await firstToken.connect(owner).approve(swap.address, MAX_UINT256);
    await secondToken.connect(owner).approve(swap.address, MAX_UINT256);
    await thirdToken.connect(owner).approve(swap.address, MAX_UINT256);
    await swapToken.connect(owner).approve(swap.address, MAX_UINT256);
    await firstToken.connect(user1).approve(swap.address, MAX_UINT256);
    await secondToken.connect(user1).approve(swap.address, MAX_UINT256);
    await thirdToken.connect(user1).approve(swap.address, MAX_UINT256);
    await swapToken.connect(user1).approve(swap.address, MAX_UINT256);
    await firstToken.connect(user2).approve(swap.address, MAX_UINT256);
    await secondToken.connect(user2).approve(swap.address, MAX_UINT256);
    await thirdToken.connect(user2).approve(swap.address, MAX_UINT256);
    await swapToken.connect(user2).approve(swap.address, MAX_UINT256);

    let txx = await swap
      .connect(user1)
      .addLiquidity(
        [String(10e18), String(10e18), String(10e18)],
        0,
        MAX_UINT256,
        {
          gasLimit: 3e7,
        }
      );
    await txx.wait();

    const Strat = await ethers.getContractFactory("Stratum");
    strat = await Strat.deploy();
    await strat.initialMint(user1.address);

    await strat.connect(user1).transfer(owner.address, BigInt(1000e18));
    await thirdToken.connect(owner).approve(router.address, MAX_UINT256);
    await strat.connect(owner).approve(router.address, MAX_UINT256);

    tx = await router
      .connect(owner)
      .addLiquidity(
        thirdToken.address,
        strat.address,
        false,
        BigInt(100e18),
        BigInt(100e18),
        0,
        0,
        owner.address,
        Date.now()
      );
    await tx.wait();

    const VeArtProxy = await ethers.getContractFactory("VeArtProxy");
    veArtProxy = await VeArtProxy.deploy();
    const VeStrat = await ethers.getContractFactory("VotingEscrow");
    veStrat = await VeStrat.deploy(strat.address, veArtProxy.address);
    const gfactory = await ethers.getContractFactory("GaugeFactory");
    GaugeFactory = await gfactory.deploy();
    const bfactory = await ethers.getContractFactory("BribeFactory");
    BribeFactory = await bfactory.deploy();
    const voter = await ethers.getContractFactory("Voter");
    Voter = await voter.deploy(
      veStrat.address,
      PairFactory.address,
      GaugeFactory.address,
      BribeFactory.address
    );
    await veStrat.setVoter(Voter.address);
    const wxbfactory = await ethers.getContractFactory(
      "WrappedExternalBribeFactory"
    );
    WxBribeFactory = await wxbfactory.deploy(
      Voter.address,
      router.address,
      firstToken.address
    );
    const metaBribe = await ethers.getContractFactory("MetaBribe");
    MetaBribe = await metaBribe.deploy(
      veStrat.address,
      Voter.address,
      WxBribeFactory.address
    );

    const rewardsDistributor = await ethers.getContractFactory(
      "RewardsDistributor"
    );
    RewardsDistributor = await rewardsDistributor.deploy(veStrat.address);

    const minter = await ethers.getContractFactory("Minter");
    Minter = await minter.deploy(
      Voter.address,
      veStrat.address,
      RewardsDistributor.address,
      MetaBribe.address
    );

    await strat.setMinter(Minter.address);
    await Minter.initialize([], [], 0);
    await Voter.initialize([], Minter.address);
    await Minter.setTeam(owner.address);
    await MetaBribe.setDepositor(Minter.address);
    await RewardsDistributor.setDepositor(Minter.address);

    await strat.connect(user1).approve(veStrat.address, MAX_UINT256);

    // creating lock for one year
    await veStrat
      .connect(user1)
      .create_lock_for(BigInt(1000e18), 365 * 86400, user1.address);

    await veStrat
      .connect(user1)
      .create_lock_for(BigInt(1000e18), 365 * 86400, user2.address);

    await veStrat
      .connect(user1)
      .create_lock_for(BigInt(16_300_000e18), 365 * 86400, owner.address);

    await veStrat
      .connect(user1)
      .create_lock_for(BigInt(1000e18), 365 * 86400, user3.address);

    await veStrat
      .connect(user1)
      .create_lock_for(BigInt(1000e18), 365 * 86400, user4.address);

    await veStrat
      .connect(user1)
      .create_lock_for(BigInt(500e18), 365 * 86400, user5.address);

    await MetaBribe.connect(owner).addPartners(
      [user1.address, user2.address, user3.address],
      [1, 2, 4]
    );

    expect(await firstToken.balanceOf(swap.address)).to.eq(String(10e18));
    expect(await secondToken.balanceOf(swap.address)).to.eq(String(10e18));
    expect(await thirdToken.balanceOf(swap.address)).to.eq(String(10e18));
  });

  describe("create gauges", function () {
    before(async () => {
      let tx = await Voter.connect(owner).whitelist(firstToken.address);
      await tx.wait();
      tx = await Voter.connect(owner).whitelist(secondToken.address);
      await tx.wait();
      tx = await Voter.connect(owner).whitelist(thirdToken.address);
      await tx.wait();
      tx = await Voter.connect(owner).createGauge3pool(
        swapToken.address,
        firstToken.address,
        secondToken.address,
        thirdToken.address,
        WxBribeFactory.address,
        { gasLimit: 3e7 }
      );
      await tx.wait();
      const gauge_address = await Voter.gauges(swapToken.address);
      const internal_bribe_address = await Voter.internal_bribes(gauge_address);
      const external_bribe_address = await Voter.external_bribes(gauge_address);
      const InternalBribe = await ethers.getContractFactory("InternalBribe");
      internal_bribe = InternalBribe.attach(internal_bribe_address);
      const ExternalBribe = await ethers.getContractFactory("ExternalBribe");
      external_bribe = ExternalBribe.attach(external_bribe_address);

      // await WxBribeFactory.createBribe(external_bribe.address);
      const wx_bribe_address = await WxBribeFactory.last_bribe();
      const wxBribe = await ethers.getContractFactory("WrappedExternalBribe");
      wx_bribe = wxBribe.attach(wx_bribe_address);

      const Gauge = await ethers.getContractFactory("Gauge");
      gauge = await Gauge.attach(gauge_address);

      tx = await swap.setRebaseHandler(gauge.address);
      await tx.wait();

      tx = await swapToken.connect(user1).approve(gauge_address, BigInt(30e18));
      await tx.wait();

      tx = await gauge
        .connect(user1)
        .deposit(BigInt(30e18), 1, { gasLimit: 3e7 });
      await tx.wait();

      // -------------------------------------------------------------

      const pool = await router.pairFor(
        firstToken.address,
        secondToken.address,
        true
      );
      console.log("pol", pool);
      tx = await Voter.connect(user2).createGauge(pool, WxBribeFactory.address);
      await tx.wait();
      const gauge_address2 = await Voter.gauges(pool);
      const external_bribe_address2 = await Voter.external_bribes(
        gauge_address2
      );
      external_bribe2 = ExternalBribe.attach(external_bribe_address2);
      // await WxBribeFactory.createBribe(external_bribe2.address);
      const wx_bribe_address2 = await WxBribeFactory.last_bribe();
      wx_bribe2 = wxBribe.attach(wx_bribe_address2);
      const Pair = await ethers.getContractFactory("Pair");
      pair = await Pair.attach(pool);

      gauge2 = await Gauge.attach(gauge_address2);
      tx = await pair.connect(user2).approve(gauge_address2, MAX_UINT256);
      await tx.wait();

      const balBefore = await pair.balanceOf(user2.address);

      tx = await gauge2.connect(user2).deposit(balBefore, 2, { gasLimit: 3e7 });
      await tx.wait();
    });

    it("metabribe values", async () => {
      await firstToken.connect(user1).approve(wx_bribe.address, MAX_UINT256);
      await wx_bribe
        .connect(user1)
        .notifyRewardAmount(
          firstToken.address,
          BigInt(50e18),
          gauge.address,
          1
        );

      let _ts = await MetaBribe.time_cursor();
      // console.log("ts", _ts);
      let mb = await wx_bribe.getMetaBribe(1, _ts);
      // console.log("mb", mb);

      expect(mb[1][0]).to.eq(BigInt(50e18));
      expect(mb[3][0]).to.eq(gauge.address);
      expect(mb[4]).to.eq(1);

      await secondToken.connect(user2).approve(wx_bribe2.address, MAX_UINT256);
      await wx_bribe2
        .connect(user2)
        .notifyRewardAmount(
          secondToken.address,
          BigInt(40e18),
          gauge2.address,
          2
        );

      mb = await wx_bribe2.getMetaBribe(2, _ts);

      await expect(
        wx_bribe2
          .connect(owner)
          .notifyRewardAmount(
            secondToken.address,
            BigInt(40e18),
            gauge2.address,
            2
          )
      ).to.be.reverted;

      console.log(mb[1][0]);
      expect(BigInt(mb[1][0])).to.eq(BigInt(40e18));
      expect(mb[3][0]).to.eq(gauge2.address);
      expect(mb[4]).to.eq(2);

      let userBribeValue1 = await MetaBribe.check_user_bribes_value(1, _ts);
      let userBribeValue2 = await MetaBribe.check_user_bribes_value(2, _ts);
      let worth = await pair.current(secondToken.address, BigInt(40e18));
      // console.log(userBribeValue / 1e18, worth[0] / 1e18);
      expect(userBribeValue2).to.eq(worth);

      const totalBribesValue = await MetaBribe.check_total_bribes_value(_ts);
      const totBribes = userBribeValue1.add(userBribeValue2);
      // console.log(totalBribesValue / 1e18);

      expect(totBribes).to.eq(totalBribesValue);
    });

    it("tests _LPTokenTo3Pool", async () => {
      // console.log(swap.address, swapToken.address);
      // console.log(
      //   "lptokentopool",
      //   await Voter._LPTokenTo3Pool(swapToken.address)
      // );
      // console.log("lptokentopool", await Voter._LPTokenTo3Pool(pair.address));
      expect(await Voter._LPTokenTo3Pool(swapToken.address)).to.eq(
        swap.address
      );
      await expect(Voter._LPTokenTo3Pool(pair.address)).to.be.reverted;
    });

    it("metabribe math", async () => {
      console.log("-----------------EPOCH 0-----------------------");
      await Voter.distro();

      console.log(
        "rebase",
        (await strat.balanceOf(RewardsDistributor.address)) / 1e18
      );
      console.log(
        "metabribe",
        (await strat.balanceOf(MetaBribe.address)) / 1e18
      );

      await Voter.connect(user1).vote(1, [pair.address], [1]);
      await Voter.connect(user2).vote(2, [pair.address], [1]);
      await Voter.connect(user3).vote(4, [pair.address], [1]);

      let timestamp = await MetaBribe.timestamp();

      // const pre1 = await MetaBribe.check_user_bribes_value(1, _ts);
      // const pre2 = await MetaBribe.check_total_bribes_value();
      // const pre3 = await Voter.poolForGauge(gauge.address);
      // const pre4 = await Voter.weights(pre3);
      // const pre5 = (2 * pre1) / pre2;

      // console.log(pre4 / partnerVotes);
      // console.log(
      //   pre1 / 1e18,
      //   pre2 / 1e18,
      //   pre3,
      //   pre4,
      //   pre5,
      //   gauge.address,
      //   _ts
      // );

      let claimable1 = await MetaBribe.claimable(1, gauge.address);
      let claimable2 = await MetaBribe.claimable(2, gauge2.address);
      console.log("claimable1 week0", claimable1 / 1e18, claimable2 / 1e18);

      let earned1 = await wx_bribe.earned(firstToken.address, 1);
      let earned2 = await wx_bribe2.earned(secondToken.address, 2);
      console.log("gauge earned", earned1 / 1e18, earned2 / 1e18);

      console.log(
        "metabribe weight 1 gauge",
        await MetaBribe.get_metabribe_weight(1, gauge.address, timestamp)
      );
      console.log(
        "metabribe weight 2 gauge2",
        await MetaBribe.get_metabribe_weight(2, gauge2.address, timestamp)
      );
      //   console.log(
      //     "metabribe weight",
      //     await MetaBribe.get_metabribe_weight(1, gauge2.address, timestamp)
      //   );
      //   console.log(
      //     "metabribe weight",
      //     await MetaBribe.get_metabribe_weight(2, gauge.address, timestamp)
      //   );
      console.log(
        "metabribe totalweight",
        await MetaBribe.get_metabribe_total_weight(timestamp)
      );
      let uservalue = await MetaBribe.check_user_bribes_value(1, timestamp);
      let totalvalue = await MetaBribe.check_total_bribes_value(timestamp);
      let first = (2 * uservalue * 1000) / totalvalue;
      let poolVotes = await Voter.weights(swapToken.address);
      let partneVotes = await MetaBribe.check_partner_votes();
      let second = (poolVotes * 1000) / partneVotes;
      console.log("value weight", first, "vote weight", second);
      uservalue = await MetaBribe.check_user_bribes_value(2, timestamp);
      first = (2 * uservalue * 1000) / totalvalue;
      poolVotes = await Voter.weights(pair.address);
      partneVotes = await MetaBribe.check_partner_votes();
      second = (poolVotes * 1000) / partneVotes;
      console.log("value weight", first, "vote weight", second);
      console.log(
        "metabribe check_user_bribes_value",
        (await MetaBribe.check_user_bribes_value(1, timestamp)) / 1e18
      );
      console.log(
        "metabribe check_user_bribes_value",
        (await MetaBribe.check_user_bribes_value(2, timestamp)) / 1e18
      );
      console.log(
        "metabribe check_total_bribes_value",
        (await MetaBribe.check_total_bribes_value(timestamp)) / 1e18
      );
      let pool = await Voter.poolForGauge(gauge2.address);
      console.log(await Voter.votesByNFTAndPool(2, pool));

      await veStrat.connect(user1).deposit_for(3, BigInt(1000000 * 1e18));

      const newWeek = async () => {
        // await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 7);

        let blockNumBefore = await ethers.provider.getBlockNumber();
        let blockBefore = await ethers.provider.getBlock(blockNumBefore);
        await time.setNextBlockTimestamp(
          blockBefore.timestamp + 60 * 60 * 24 * 7
        );
        await Minter.update_period();
        // await Voter.distro();

        await secondToken.connect(user1).approve(wx_bribe.address, MAX_UINT256);

        await wx_bribe
          .connect(user1)
          .notifyRewardAmount(
            secondToken.address,
            BigInt(500e18),
            gauge.address,
            1
          );

        await firstToken.connect(user1).approve(wx_bribe2.address, MAX_UINT256);

        await wx_bribe2
          .connect(user1)
          .notifyRewardAmount(
            firstToken.address,
            BigInt(500e18),
            gauge2.address,
            2
          );

        console.log(
          "rebase contract balance",
          (await strat.balanceOf(RewardsDistributor.address)) / 1e18
        );
        console.log(
          "metabribe contract balance",
          (await strat.balanceOf(MetaBribe.address)) / 1e18
        );
        console.log(
          "team wallet balance",
          (await strat.balanceOf(owner.address)) / 1e18
        );

        // const veStratBal = await veStrat.totalSupply();
        // const stratBal = await strat.totalSupply();
        // const weekly = await Minter.weekly();
        // const rebaseBal = await Minter.calculate_growth(weekly);
        // const percent = rebaseBal / veStratBal;
        // const lock = veStratBal / stratBal;
        // console.log(
        //   "apr in previous epoch + current lockrate",
        //   (1 + percent) ** 52,
        //   lock
        // );

        timestamp = await MetaBribe.timestamp();

        // console.log(
        //   "tokens_per_week mb",
        //   (await MetaBribe.tokens_per_week(timestamp)) / 1e18
        // );
        // console.log(
        //   "tokens_per_week rebase",
        //   (await RewardsDistributor.tokens_per_week(timestamp)) / 1e18
        // );

        console.log(
          "getmetabribe tokenId 1",
          await wx_bribe.getMetaBribe(1, timestamp)
        );

        console.log(
          "getmetabribe tokenId 2",
          await wx_bribe2.getMetaBribe(2, timestamp)
        );

        await Voter.connect(user1).vote(1, [swapToken.address], [1]);
        await Voter.connect(user2).vote(2, [pair.address], [1]);
        await Voter.connect(user3).vote(4, [pair.address], [1]);

        let claimable1 = await MetaBribe.claimable(1, gauge.address);
        let claimable2 = await MetaBribe.claimable(2, gauge2.address);
        let claimable5 = await MetaBribe.claimable(4, gauge.address);
        console.log(
          "claimable metabribes week2, tokenId 1, 2, 4",
          claimable1 / 1e18,
          claimable2 / 1e18,
          claimable5 / 1e18
        );
        let claimable3 = await RewardsDistributor.claimable(1);
        let claimable4 = await RewardsDistributor.claimable(2);

        console.log("rebase week2", claimable3 / 1e18, claimable4 / 1e18);

        let earned1 = await wx_bribe.earned(firstToken.address, 1);
        let earned2 = await wx_bribe2.earned(secondToken.address, 2);
        console.log("gauge earned", earned1 / 1e18, earned2 / 1e18);

        console.log("4 balance", await veStrat.balanceOf(user3.address));

        await MetaBribe.connect(user1).claim(1, gauge.address);
        await MetaBribe.connect(user2).claim(2, gauge2.address);
        await MetaBribe.connect(user3).claim(4, gauge.address);

        console.log("4 balance", await veStrat.balanceOf(user3.address));

        // console.log(
        //   "metabribe contract balance",
        //   (await strat.balanceOf(MetaBribe.address)) / 1e18
        // );
        claimable1 = await MetaBribe.claimable(1, gauge.address);
        claimable2 = await MetaBribe.claimable(2, gauge2.address);
        console.log("claimable1 week4", claimable1 / 1e18, claimable2 / 1e18);

        await RewardsDistributor.claim(1);
        await RewardsDistributor.claim(2);
        await RewardsDistributor.claim(3);
        await RewardsDistributor.claim(4);
        await RewardsDistributor.claim(5);

        console.log(
          "metabribe weight 1 gauge",
          await MetaBribe.get_metabribe_weight(1, gauge.address, timestamp)
        );
        console.log(
          "metabribe weight 2 gauge2",
          await MetaBribe.get_metabribe_weight(2, gauge2.address, timestamp)
        );
        // console.log(
        //   "metabribe weight 4 gauge",
        //   await MetaBribe.get_metabribe_weight(4, gauge.address, timestamp)
        // );
        // console.log(
        //   "metabribe weight",
        //   await MetaBribe.get_metabribe_weight(1, gauge2.address, timestamp)
        // );
        // console.log(
        //   "metabribe weight",
        //   await MetaBribe.get_metabribe_weight(2, gauge.address, timestamp)
        // );
        console.log(
          "metabribe totalweight",
          await MetaBribe.get_metabribe_total_weight(timestamp)
        );
        let uservalue = await MetaBribe.check_user_bribes_value(1, timestamp);
        let totalvalue = await MetaBribe.check_total_bribes_value(timestamp);
        let first = (2 * uservalue * 1000) / totalvalue;
        let poolVotes = await Voter.weights(swapToken.address);
        let partneVotes = await MetaBribe.check_partner_votes();
        let second = (poolVotes * 1000) / partneVotes;
        console.log("value weight", first, "vote weight", second);
        uservalue = await MetaBribe.check_user_bribes_value(2, timestamp);
        totalvalue = await MetaBribe.check_total_bribes_value(timestamp);
        first = (2 * uservalue * 1000) / totalvalue;
        poolVotes = await Voter.weights(pair.address);
        partneVotes = await MetaBribe.check_partner_votes();
        second = (poolVotes * 1000) / partneVotes;
        console.log("value weight", first, "vote weight", second);
        console.log(
          "metabribe check_user_bribes_value",
          (await MetaBribe.check_user_bribes_value(1, timestamp)) / 1e18
        );
        console.log(
          "metabribe check_user_bribes_value",
          (await MetaBribe.check_user_bribes_value(2, timestamp)) / 1e18
        );
        console.log(
          "metabribe check_total_bribes_value",
          (await MetaBribe.check_total_bribes_value(timestamp)) / 1e18
        );
        // console.log(
        //   "metabribe check_partner_votes",
        //   (await MetaBribe.check_partner_votes()) / 1e18
        // );
      };
      console.log("-----------------EPOCH 1-----------------------");
      await newWeek();
      await MetaBribe.connect(user1).claim(1, gauge.address);
      console.log("-----------------EPOCH 2-----------------------");
      await newWeek();
      // await MetaBribe.connect(user1).claim(1, gauge.address);
      await wx_bribe
        .connect(user1)
        .notifyRewardAmount(
          secondToken.address,
          BigInt(500e18),
          gauge.address,
          4
        );
      console.log(
        "metabribe weight 4 gauge",
        await MetaBribe.get_metabribe_weight(4, gauge.address, timestamp)
      );
      // await MetaBribe.addPartners([user3.address], [4]);
      console.log("-----------------EPOCH 3-----------------------");
      await newWeek();
      console.log("-----------------EPOCH 4-----------------------");
      await newWeek();
      console.log("-----------------EPOCH 5-----------------------");
      await newWeek();
      await MetaBribe.addPartners([user4.address], [5]);
      console.log("-----------------EPOCH 6-----------------------");
      await newWeek();
      console.log("-----------------EPOCH 7-----------------------");
      await newWeek();
    });
  });
});
