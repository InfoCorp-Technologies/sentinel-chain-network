const Web3Utils = require('web3-utils');
const HomeBridge = artifacts.require("HomeBridgeErcToErc.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const SeniToken = artifacts.require("SeniToken.sol");
const Whitelist = artifacts.require("Whitelist.sol");
const TollBox = artifacts.require("TollBox.sol");
const { ERROR_MSG, ZERO_ADDRESS } = require('../setup.js');
const { createMessage, sign } = require('./helpers/helpers');
const tollFee = web3.toBigNumber(web3.toWei(10, "ether"));
const minPerTx = web3.toBigNumber(web3.toWei(11, "ether"));
const minValueToTransfer = web3.toBigNumber(web3.toWei(11, "ether"));
const requireBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');
const homeDailyLimit = web3.toBigNumber(web3.toWei(10000, "ether"));
const homeMaxPerTx = web3.toBigNumber(web3.toWei(100, "ether"));
const foreignDailyLimit = homeDailyLimit
const foreignMaxPerTx = homeMaxPerTx

contract('HomeBridge_ERC20_to_ERC20', async (accounts) => {
  let homeContract, validatorContract, authorities, owner, token, whitelistContract, tollContract;

  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1]];
    owner = accounts[0]
    user = accounts[9]
    await validatorContract.initialize(1, authorities, owner)
    whitelistContract = await Whitelist.new(owner);
    await whitelistContract.addAddresses([user], { from: owner })
  })

  describe('#initialize', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      token = await SeniToken.new(whitelistContract.address);
      tollContract = await TollBox.new(20, token.address, homeContract.address)
    })

    it('sets variables', async () => {
      ZERO_ADDRESS.should.be.equal(await homeContract.validatorContract())
      '0'.should.be.bignumber.equal(await homeContract.deployedAtBlock())
      '0'.should.be.bignumber.equal(await homeContract.dailyLimit())
      '0'.should.be.bignumber.equal(await homeContract.maxPerTx())
      false.should.be.equal(await homeContract.isInitialized())
      await homeContract.initialize(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        homeDailyLimit,
        homeMaxPerTx,
        minPerTx,
        gasPrice,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      ).should.be.fulfilled;
      true.should.be.equal(await homeContract.isInitialized())
      validatorContract.address.should.be.equal(await homeContract.validatorContract());
      (await homeContract.deployedAtBlock()).should.be.bignumber.above(0);
      homeDailyLimit.should.be.bignumber.equal(await homeContract.dailyLimit())
      homeMaxPerTx.should.be.bignumber.equal(await homeContract.maxPerTx())
      minPerTx.should.be.bignumber.equal(await homeContract.minPerTx())
      const [major, minor, patch] = await homeContract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })

    it('cant set maxPerTx > dailyLimit', async () => {
      false.should.be.equal(await homeContract.isInitialized())
      await homeContract.initialize(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        '1',
        '2',
        '1',
        gasPrice,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      ).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        '3',
        '2',
        '2',
        gasPrice,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      ).should.be.rejectedWith(ERROR_MSG);
      false.should.be.equal(await homeContract.isInitialized())
    })

    it('can be deployed via upgradeToAndCall', async () => {
      let storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      const data = homeContract.initialize.request(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        "3",
        "2",
        "1",
        gasPrice,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      ).params[0].data;
      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled;
      let finalContract = await HomeBridge.at(storageProxy.address);
      true.should.be.equal(await finalContract.isInitialized());
      validatorContract.address.should.be.equal(await finalContract.validatorContract())
      "3".should.be.bignumber.equal(await finalContract.dailyLimit())
      "2".should.be.bignumber.equal(await finalContract.maxPerTx())
      "1".should.be.bignumber.equal(await finalContract.minPerTx())
    })

    it('cant initialize with invalid arguments', async () => {
      false.should.be.equal(await homeContract.isInitialized())
      await homeContract.initialize(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        '3',
        '2',
        '1',
        gasPrice,
        0,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      ).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(
        owner,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        '3',
        '2',
        '1',
        gasPrice,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      ).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(
        ZERO_ADDRESS,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        '3',
        '2',
        '1',
        gasPrice,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      ).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(
        validatorContract.address,
        whitelistContract.address,
        owner,
        tollFee,
        '3',
        '2',
        '1',
        gasPrice,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      ).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(
        validatorContract.address,
        whitelistContract.address,
        ZERO_ADDRESS,
        tollFee,
        '3',
        '2',
        '1',
        gasPrice,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      ).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        '3',
        '2',
        '1',
        gasPrice,
        requireBlockConfirmations,
        ZERO_ADDRESS,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      ).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        '3',
        '2',
        '1',
        gasPrice,
        requireBlockConfirmations,
        owner,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      ).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        '3',
        '2',
        '1',
        gasPrice,
        requireBlockConfirmations,
        token.address,
        foreignMaxPerTx,
        foreignDailyLimit,
        owner
      ).should.be.rejectedWith(ERROR_MSG)
      await homeContract.initialize(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        '3',
        '2',
        '1',
        0,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      ).should.be.fulfilled;
      true.should.be.equal(await homeContract.isInitialized())
    })
  })

  describe('#fallback', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      token = await SeniToken.new(whitelistContract.address);
      tollContract = await TollBox.new(20, token.address, homeContract.address)
      await homeContract.initialize(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        '3',
        '2',
        '1',
        0,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      )
    })
    it('reverts', async () => {
      const { logs } = await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#setting limits', async () => {
    let homeContract;
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      token = await SeniToken.new(whitelistContract.address);
      tollContract = await TollBox.new(20, token.address, homeContract.address)
      await homeContract.initialize(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        '3',
        '2',
        '1',
        0,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      )
    })
    it('#setMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await homeContract.setMaxPerTx(2, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setMaxPerTx(2, { from: owner }).should.be.fulfilled;
      await homeContract.setMaxPerTx(3, { from: owner }).should.be.rejectedWith(ERROR_MSG);
    })

    it('#setMinPerTx allows to set only to owner and cannot be more than daily limit and should be less than maxPerTx', async () => {
      await homeContract.setMinPerTx(1, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setMinPerTx(1, { from: owner }).should.be.fulfilled;
      await homeContract.setMinPerTx(2, { from: owner }).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe('#executeAffirmation', async () => {
    let homeBridge;
    beforeEach(async () => {
      homeBridge = await HomeBridge.new();
      whitelistContract = await Whitelist.new(owner);
      token = await SeniToken.new(whitelistContract.address);
      tollContract = await TollBox.new(20, token.address, homeBridge.address)
      await whitelistContract.addAddresses([homeBridge.address, tollContract.address], { from: owner })
      await homeBridge.initialize(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        homeDailyLimit,
        homeMaxPerTx,
        minPerTx,
        0,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      )
      await token.transferOwnership(homeBridge.address);
    })

    it('should allow validator to withdraw', async () => {
      const recipient = accounts[5];
      await whitelistContract.addAddresses([recipient], { from: owner })
      const value = foreignMaxPerTx;
      const balanceBefore = await token.balanceOf(recipient)
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, { from: authorities[0] })
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: authorities[0],
        transactionHash
      });
      logs[1].event.should.be.equal("AffirmationCompleted");
      logs[1].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })
      const totalSupply = await token.totalSupply()
      const balanceAfter = await token.balanceOf(recipient)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value).sub(tollFee))
      totalSupply.should.be.bignumber.equal(value)

      const msgHash = Web3Utils.soliditySha3(recipient, value, transactionHash);
      const senderHash = Web3Utils.soliditySha3(authorities[0], msgHash)
      true.should.be.equal(await homeBridge.affirmationsSigned(senderHash))
      const markedAsProcessed = new web3.BigNumber(2).pow(255).add(1);
      markedAsProcessed.should.be.bignumber.equal(await homeBridge.numAffirmationsSigned(msgHash));
      await homeBridge.executeAffirmation(recipient, value, transactionHash, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)
    })

    it('test with 2 signatures required', async () => {
      let token2sig = await SeniToken.new(whitelistContract.address);
      let validatorContractWith2Signatures = await BridgeValidators.new()
      let authoritiesTwoAccs = [accounts[2], accounts[3], accounts[4]];
      let ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesTwoAccs, ownerOfValidators)
      let homeBridgeWithTwoSigs = await HomeBridge.new();
      let tollContractTwoSigs = await TollBox.new(20, token2sig.address, homeBridgeWithTwoSigs.address)
      await homeBridgeWithTwoSigs.initialize(
        validatorContractWith2Signatures.address,
        whitelistContract.address,
        tollContractTwoSigs.address,
        tollFee,
        homeDailyLimit,
        homeMaxPerTx,
        minPerTx,
        0,
        requireBlockConfirmations,
        token2sig.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      )
      await token2sig.transferOwnership(homeBridgeWithTwoSigs.address);
      const recipient = accounts[5];
      await whitelistContract.addAddresses([recipient, homeBridgeWithTwoSigs.address, tollContractTwoSigs.address], { from: owner })
      const value = minValueToTransfer;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const balanceBefore = await token2sig.balanceOf(recipient)
      const msgHash = Web3Utils.soliditySha3(recipient, value, transactionHash);

      const { logs } = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, { from: authoritiesTwoAccs[1] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: authoritiesTwoAccs[1],
        transactionHash
      });
      '0'.should.be.bignumber.equal(await token2sig.totalSupply())
      const notProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash);
      notProcessed.should.be.bignumber.equal(1);

      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, { from: authoritiesTwoAccs[1] }).should.be.rejectedWith(ERROR_MSG);
      const secondSignature = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, { from: authoritiesTwoAccs[0] }).should.be.fulfilled;

      const balanceAfter = await token2sig.balanceOf(recipient)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value).sub(tollFee))

      secondSignature.logs[1].event.should.be.equal("AffirmationCompleted");
      secondSignature.logs[1].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })

      const senderHash = Web3Utils.soliditySha3(authoritiesTwoAccs[0], msgHash)
      true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash))

      const senderHash2 = Web3Utils.soliditySha3(authoritiesTwoAccs[1], msgHash);
      true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash2))

      const markedAsProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash);
      const processed = new web3.BigNumber(2).pow(255).add(2);
      markedAsProcessed.should.be.bignumber.equal(processed)
    })

    it('should not allow to double submit', async () => {
      const recipient = accounts[5];
      const value = minValueToTransfer;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      await homeBridge.executeAffirmation(recipient, value, transactionHash, { from: authorities[0] }).should.be.fulfilled;
      await homeBridge.executeAffirmation(recipient, value, transactionHash, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG);
    })

    it('should not allow non-authorities to execute deposit', async () => {
      const recipient = accounts[5];
      const value = foreignDailyLimit;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      await homeBridge.executeAffirmation(recipient, value, transactionHash, { from: accounts[7] }).should.be.rejectedWith(ERROR_MSG);
    })

    it('doesnt allow to deposit if requiredSignatures has changed', async () => {
      let token2sig = await SeniToken.new(whitelistContract.address);
      let validatorContractWith2Signatures = await BridgeValidators.new()
      let authoritiesTwoAccs = [accounts[1], accounts[2], accounts[3]];
      let ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesTwoAccs, ownerOfValidators)
      let homeBridgeWithTwoSigs = await HomeBridge.new();
      let tollContractTwoSigs = await TollBox.new(20, token2sig.address, homeBridgeWithTwoSigs.address)
      await homeBridgeWithTwoSigs.initialize(
        validatorContractWith2Signatures.address,
        whitelistContract.address,
        tollContractTwoSigs.address,
        tollFee,
        homeDailyLimit,
        homeMaxPerTx,
        minPerTx,
        0,
        requireBlockConfirmations,
        token2sig.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      )
      await token2sig.transferOwnership(homeBridgeWithTwoSigs.address);
      const recipient = accounts[5];
      await whitelistContract.addAddresses([recipient, homeBridgeWithTwoSigs.address, tollContractTwoSigs.address], { from: owner })
      const value = minValueToTransfer;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const balanceBefore = await token.balanceOf(recipient)
      const msgHash = Web3Utils.soliditySha3(recipient, value, transactionHash);

      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, { from: authoritiesTwoAccs[0] }).should.be.fulfilled;
      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, { from: authoritiesTwoAccs[1] }).should.be.fulfilled;
      const balanceAfter = balanceBefore.add(value).sub(tollFee);
      balanceAfter.should.be.bignumber.equal(await token2sig.balanceOf(recipient))
      await validatorContractWith2Signatures.setRequiredSignatures(3).should.be.fulfilled;
      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, { from: authoritiesTwoAccs[2] }).should.be.rejectedWith(ERROR_MSG);
      await validatorContractWith2Signatures.setRequiredSignatures(1).should.be.fulfilled;
      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, { from: authoritiesTwoAccs[2] }).should.be.rejectedWith(ERROR_MSG);
      balanceAfter.should.be.bignumber.equal(await token2sig.balanceOf(recipient))
    })

    it('works with 5 validators and 3 required signatures', async () => {
      const recipient = accounts[9]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      let ownerOfValidators = accounts[0]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)
      const token = await SeniToken.new(whitelistContract.address);

      const homeBridgeWithThreeSigs = await HomeBridge.new();
      let tollContractTwoSigs = await TollBox.new(20, token.address, homeBridgeWithThreeSigs.address)
      await whitelistContract.addAddresses([recipient, homeBridgeWithThreeSigs.address, tollContractTwoSigs.address], { from: owner })
      await homeBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        whitelistContract.address,
        tollContractTwoSigs.address,
        tollFee,
        homeDailyLimit,
        homeMaxPerTx,
        minPerTx,
        0,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      )
      await token.transferOwnership(homeBridgeWithThreeSigs.address);

      const value = minValueToTransfer;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";

      const { logs } = await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, { from: authoritiesFiveAccs[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: authoritiesFiveAccs[0],
        transactionHash
      });

      await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, { from: authoritiesFiveAccs[1] }).should.be.fulfilled;
      const thirdSignature = await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, { from: authoritiesFiveAccs[2] }).should.be.fulfilled;

      thirdSignature.logs[1].event.should.be.equal("AffirmationCompleted");
      thirdSignature.logs[1].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })
    })

    it('should not allow execute affirmation over foreign max tx limit', async () => {
      const recipient = accounts[5];
      const value = foreignDailyLimit;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, { from: authorities[0] }).should.be.fulfilled;

      logs[0].event.should.be.equal("AmountLimitExceeded");
      logs[0].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      });
    })

    it('should fail if txHash already set as above of limits', async () => {
      const recipient = accounts[5];
      const value = foreignDailyLimit;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, { from: authorities[0] }).should.be.fulfilled;

      logs[0].event.should.be.equal("AmountLimitExceeded");
      logs[0].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      });

      await homeBridge.executeAffirmation(recipient, value, transactionHash, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.executeAffirmation(accounts[6], value, transactionHash, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)
    })

    it('should not allow execute affirmation over daily foreign limit', async () => {
      homeBridge = await HomeBridge.new();
      whitelistContract = await Whitelist.new(owner);
      token = await SeniToken.new(whitelistContract.address);
      tollContract = await TollBox.new(20, token.address, homeBridge.address)
      await homeBridge.initialize(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        web3.toBigNumber(web3.toWei(40, "ether")),
        web3.toBigNumber(web3.toWei(20, "ether")),
        web3.toBigNumber(web3.toWei(5, "ether")),
        0,
        requireBlockConfirmations,
        token.address,
        web3.toBigNumber(web3.toWei(40, "ether")),
        web3.toBigNumber(web3.toWei(20, "ether")),
        owner
      )
      await token.transferOwnership(homeBridge.address);

      const recipient = accounts[5];
      await whitelistContract.addAddresses([recipient, homeBridge.address, tollContract.address], { from: owner })
      const value = web3.toBigNumber(web3.toWei(20, "ether"));
      const receivedValue = value.sub(tollFee);

      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, { from: authorities[0] }).should.be.fulfilled;

      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: authorities[0],
        transactionHash
      });
      logs[1].event.should.be.equal("AffirmationCompleted");
      logs[1].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })

      const transactionHash2 = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      const { logs: logs2 } = await homeBridge.executeAffirmation(recipient, value, transactionHash2, { from: authorities[0] }).should.be.fulfilled;

      logs2[0].event.should.be.equal("SignedForAffirmation");
      logs2[0].args.should.be.deep.equal({
        signer: authorities[0],
        transactionHash: transactionHash2
      });
      logs2[1].event.should.be.equal("AffirmationCompleted");
      logs2[1].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash: transactionHash2
      })

      const transactionHash3 = "0x69debd8fd1923c9cb3cd8ef6461e2740b2d037943b941729d5a47671a2bb8712";
      const { logs: logs3 } = await homeBridge.executeAffirmation(recipient, value, transactionHash3, { from: authorities[0] }).should.be.fulfilled;

      logs3[0].event.should.be.equal("AmountLimitExceeded");
      logs3[0].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash: transactionHash3
      });

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(web3.toBigNumber(web3.toWei(20, "ether")))

      const transactionHash4 = "0xc9ffe298d85ec5c515153608924b7bdcf1835539813dcc82cdbcc071170c3196";
      const { logs: logs4 } = await homeBridge.executeAffirmation(recipient, value, transactionHash4, { from: authorities[0] }).should.be.fulfilled;

      logs4[0].event.should.be.equal("AmountLimitExceeded");
      logs4[0].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash: transactionHash4
      });

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(web3.toBigNumber(web3.toWei(40, "ether")))
    })
  })

  describe('#isAlreadyProcessed', async () => {
    it('returns ', async () => {
      homeBridge = await HomeBridge.new();
      const bn = new web3.BigNumber(2).pow(255);
      const processedNumbers = [bn.add(1).toString(10), bn.add(100).toString(10)];
      true.should.be.equal(await homeBridge.isAlreadyProcessed(processedNumbers[0]));
      true.should.be.equal(await homeBridge.isAlreadyProcessed(processedNumbers[1]));
      false.should.be.equal(await homeBridge.isAlreadyProcessed(10));
    })
  })

  describe('#submitSignature', async () => {
    let validatorContractWith2Signatures, authoritiesTwoAccs, ownerOfValidators, homeBridgeWithTwoSigs, tollContractWithTwoSigs

    beforeEach(async () => {
      let token2sig = await SeniToken.new(whitelistContract.address);
      validatorContractWith2Signatures = await BridgeValidators.new()
      authoritiesTwoAccs = [accounts[1], accounts[2], accounts[3]];
      ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesTwoAccs, ownerOfValidators)
      homeBridgeWithTwoSigs = await HomeBridge.new();
      tollContractWithTwoSigs = await TollBox.new(20, token2sig.address, homeBridgeWithTwoSigs.address)
      await homeBridgeWithTwoSigs.initialize(
        validatorContractWith2Signatures.address,
        whitelistContract.address,
        tollContractWithTwoSigs.address,
        tollFee,
        homeDailyLimit,
        homeMaxPerTx,
        minPerTx,
        0,
        requireBlockConfirmations,
        token2sig.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      )

      await token2sig.transferOwnership(homeBridgeWithTwoSigs.address);
    })

    it('allows a validator to submit a signature', async () => {
      var recipientAccount = accounts[8]
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address);
      var signature = await sign(authoritiesTwoAccs[0], message)
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature, message, { from: authorities[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal('SignedForUserRequest')
      const msgHashFromLog = logs[0].args.messageHash
      const signatureFromContract = await homeBridgeWithTwoSigs.signature(msgHashFromLog, 0);
      const messageFromContract = await homeBridgeWithTwoSigs.message(msgHashFromLog);

      signature.should.be.equal(signatureFromContract);
      messageFromContract.should.be.equal(messageFromContract);
      const hashMsg = Web3Utils.soliditySha3(message);
      '1'.should.be.bignumber.equal(await homeBridgeWithTwoSigs.numMessagesSigned(hashMsg))
      const hashSenderMsg = Web3Utils.soliditySha3(authorities[0], hashMsg)
      true.should.be.equal(await homeBridgeWithTwoSigs.messagesSigned(hashSenderMsg));
    })

    it('when enough requiredSignatures are collected, CollectedSignatures event is emitted', async () => {
      var recipientAccount = accounts[8]
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address);
      const hashMsg = Web3Utils.soliditySha3(message);
      var signature = await sign(authoritiesTwoAccs[0], message)
      var signature2 = await sign(authoritiesTwoAccs[1], message)
      '2'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      await homeBridgeWithTwoSigs.submitSignature(signature, message, { from: authoritiesTwoAccs[0] }).should.be.fulfilled;
      await homeBridgeWithTwoSigs.submitSignature(signature, message, { from: authoritiesTwoAccs[0] }).should.be.rejectedWith(ERROR_MSG);
      await homeBridgeWithTwoSigs.submitSignature(signature, message, { from: authoritiesTwoAccs[1] }).should.be.rejectedWith(ERROR_MSG);
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, { from: authoritiesTwoAccs[1] }).should.be.fulfilled;
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesTwoAccs[1])
      const markedAsProcessed = new web3.BigNumber(2).pow(255).add(2);
      markedAsProcessed.should.be.bignumber.equal(await homeBridgeWithTwoSigs.numMessagesSigned(hashMsg))
    })

    it('works with 5 validators and 3 required signatures', async () => {
      const recipientAccount = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)
      const token = await SeniToken.new(whitelistContract.address);

      const homeBridgeWithThreeSigs = await HomeBridge.new();
      const tollContractWithThreeSigs = await TollBox.new(20, token.address, homeBridgeWithThreeSigs.address)
      await homeBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        whitelistContract.address,
        tollContractWithThreeSigs.address,
        tollFee,
        homeDailyLimit,
        homeMaxPerTx,
        minPerTx,
        0,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      )

      const value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      const transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithThreeSigs.address);
      const signature = await sign(authoritiesFiveAccs[0], message)
      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const signature3 = await sign(authoritiesFiveAccs[2], message)
      '3'.should.be.bignumber.equal(await validatorContractWith3Signatures.requiredSignatures());

      await homeBridgeWithThreeSigs.submitSignature(signature, message, { from: authoritiesFiveAccs[0] }).should.be.fulfilled;
      await homeBridgeWithThreeSigs.submitSignature(signature2, message, { from: authoritiesFiveAccs[1] }).should.be.fulfilled;
      const { logs } = await homeBridgeWithThreeSigs.submitSignature(signature3, message, { from: authoritiesFiveAccs[2] }).should.be.fulfilled;
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesFiveAccs[2])
    })

    it('attack when increasing requiredSignatures', async () => {
      var recipientAccount = accounts[8]
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address);
      var signature = await sign(authoritiesTwoAccs[0], message)
      var signature2 = await sign(authoritiesTwoAccs[1], message)
      var signature3 = await sign(authoritiesTwoAccs[2], message)
      '2'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      await homeBridgeWithTwoSigs.submitSignature(signature, message, { from: authoritiesTwoAccs[0] }).should.be.fulfilled;
      await homeBridgeWithTwoSigs.submitSignature(signature, message, { from: authoritiesTwoAccs[0] }).should.be.rejectedWith(ERROR_MSG);
      await homeBridgeWithTwoSigs.submitSignature(signature, message, { from: authoritiesTwoAccs[1] }).should.be.rejectedWith(ERROR_MSG);
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, { from: authoritiesTwoAccs[1] }).should.be.fulfilled;
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesTwoAccs[1])
      await validatorContractWith2Signatures.setRequiredSignatures(3).should.be.fulfilled;
      '3'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      await homeBridgeWithTwoSigs.submitSignature(signature3, message, { from: authoritiesTwoAccs[2] }).should.be.rejectedWith(ERROR_MSG);
    })

    it('attack when decreasing requiredSignatures', async () => {
      var recipientAccount = accounts[8]
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address);
      var signature = await sign(authoritiesTwoAccs[0], message)
      var signature2 = await sign(authoritiesTwoAccs[1], message)
      var signature3 = await sign(authoritiesTwoAccs[2], message)
      '2'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      await homeBridgeWithTwoSigs.submitSignature(signature, message, { from: authoritiesTwoAccs[0] }).should.be.fulfilled;
      await validatorContractWith2Signatures.setRequiredSignatures(1).should.be.fulfilled;
      '1'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, { from: authoritiesTwoAccs[1] }).should.be.fulfilled;
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesTwoAccs[1])
    })
  })

  describe('#toll', async () => {
    let ownerOfValidators, amount

    beforeEach(async () => {
      amount = web3.toBigNumber(web3.toWei(15, "ether"));
      token = await SeniToken.new(whitelistContract.address);
      validatorContract = await BridgeValidators.new()
      await validatorContract.initialize(1, authorities, owner)
      homeContract = await HomeBridge.new();
      tollContract = await TollBox.new(20, token.address, homeContract.address)
      await homeContract.initialize(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        homeDailyLimit,
        homeMaxPerTx,
        minPerTx,
        0,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      )
      await whitelistContract.addAddresses([user, homeContract.address, tollContract.address], { from: owner })
      await token.setBridgeContract(homeContract.address).should.be.fulfilled;
      await token.mint(user, amount).should.be.fulfilled;
      await token.transferOwnership(homeContract.address);
    })

    it('when user made deposit, discount the toll', async () => {
      '0'.should.be.bignumber.equal(await token.balanceOf(homeContract.address));
      '0'.should.be.bignumber.equal(await token.balanceOf(tollContract.address));
      '15000000000000000000'.should.be.bignumber.equal(await token.balanceOf(user));

      const result = await token.transferAndCall(homeContract.address, amount, '0x', { from: user }).should.be.fulfilled;
      result.logs[0].event.should.be.equal("Transfer")
      result.logs[0].args.should.be.deep.equal({
        from: user,
        to: homeContract.address,
        value: amount
      })
      result.logs[4].event.should.be.equal("Burn")
      result.logs[4].args.should.be.deep.equal({
        burner: homeContract.address,
        value: web3.toBigNumber('5000000000000000000')
      })

      '0'.should.be.bignumber.equal(await token.balanceOf(homeContract.address));
      '10000000000000000000'.should.be.bignumber.equal(await token.balanceOf(tollContract.address));
      '0'.should.be.bignumber.equal(await token.balanceOf(user));
    })

    it('non-whitelisted user can not made Deposit flow', async () => {
      '0'.should.be.bignumber.equal(await token.balanceOf(homeContract.address));
      '0'.should.be.bignumber.equal(await token.balanceOf(tollContract.address));
      '15000000000000000000'.should.be.bignumber.equal(await token.balanceOf(user));

      await whitelistContract.removeAddresses([user], { from: owner })
      await token.transferAndCall(homeContract.address, amount, '0x', { from: user }).should.be.rejectedWith(ERROR_MSG);

      '0'.should.be.bignumber.equal(await token.balanceOf(homeContract.address));
      '0'.should.be.bignumber.equal(await token.balanceOf(tollContract.address));
      '15000000000000000000'.should.be.bignumber.equal(await token.balanceOf(user));
    })

    it('can not made Deposit flow from amounts below the minPerTx', async () => {
      '0'.should.be.bignumber.equal(await token.balanceOf(homeContract.address));
      '0'.should.be.bignumber.equal(await token.balanceOf(tollContract.address));
      '15000000000000000000'.should.be.bignumber.equal(await token.balanceOf(user));

      await token.transferAndCall(homeContract.address, web3.toBigNumber('10000000000000000000'), '0x', { from: user }).should.be.rejectedWith(ERROR_MSG);

      '0'.should.be.bignumber.equal(await token.balanceOf(homeContract.address));
      '0'.should.be.bignumber.equal(await token.balanceOf(tollContract.address));
      '15000000000000000000'.should.be.bignumber.equal(await token.balanceOf(user));
    })
  })

  describe('#requiredMessageLength', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
    })

    it('should return the required message length', async () => {
      const requiredMessageLength = await homeContract.requiredMessageLength()
      '104'.should.be.bignumber.equal(requiredMessageLength)
    })
  })

  describe('#fixAssetsAboveLimits', async () => {
    let homeBridge;
    const zeroValue = web3.toBigNumber(web3.toWei(0, "ether"))

    beforeEach(async () => {
      const homeBridgeImpl = await HomeBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      homeBridge = await HomeBridge.at(storageProxy.address);
      await homeBridge.initialize(
        validatorContract.address,
        whitelistContract.address,
        tollContract.address,
        tollFee,
        homeDailyLimit,
        homeMaxPerTx,
        minPerTx,
        0,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner
      )
    })

    it('Should reduce outOfLimitAmount and not emit any event', async () => {
      const recipient = accounts[5];
      const value = foreignDailyLimit;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, { from: authorities[0] }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal("AmountLimitExceeded");

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      const { logs } = await homeBridge.fixAssetsAboveLimits(transactionHash, false).should.be.fulfilled

      logs.length.should.be.equal(0)

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(zeroValue)
    })

    it('Should reduce outOfLimitAmount and emit UserRequestForSignature', async () => {
      const recipient = accounts[5];
      const value = foreignDailyLimit;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, { from: authorities[0] }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal("AmountLimitExceeded");

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      const { logs } = await homeBridge.fixAssetsAboveLimits(transactionHash, true).should.be.fulfilled

      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('UserRequestForSignature')
      logs[0].args.should.be.deep.equal({
        recipient,
        value
      })

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(zeroValue)
    })

    it('Should not be allow to be called by an already fixed txHash', async () => {
      const recipient = accounts[5];
      const value = foreignDailyLimit;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const transactionHash2 = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";

      await homeBridge.executeAffirmation(recipient, value, transactionHash, { from: authorities[0] }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash2, { from: authorities[0] }).should.be.fulfilled

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value.add(value))

      await homeBridge.fixAssetsAboveLimits(transactionHash, false).should.be.fulfilled

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(value)

      await homeBridge.fixAssetsAboveLimits(transactionHash, false).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.fixAssetsAboveLimits(transactionHash2, false).should.be.fulfilled

      const updatedOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      updatedOutOfLimitAmount.should.be.bignumber.equal(zeroValue)

      await homeBridge.fixAssetsAboveLimits(transactionHash2, false).should.be.rejectedWith(ERROR_MSG)
    })

    it('Should fail if txHash didnt increase out of limit amount', async () => {
      const recipient = accounts[5];
      const value = foreignDailyLimit;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const invalidTxHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";

      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, { from: authorities[0] }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal("AmountLimitExceeded");

      await homeBridge.fixAssetsAboveLimits(invalidTxHash, true).should.be.rejectedWith(ERROR_MSG)
    })

    it('Should fail if not called by proxyOwner', async () => {
      const recipient = accounts[5];
      const value = foreignDailyLimit;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";

      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, { from: authorities[0] }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal("AmountLimitExceeded");

      await homeBridge.fixAssetsAboveLimits(transactionHash, true, { from: recipient }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.fixAssetsAboveLimits(transactionHash, true, { from: owner }).should.be.fulfilled
    })
  })

  describe('#OwnedUpgradeability', async () => {
    it('upgradeabilityAdmin should return the proxy owner', async () => {
      const homeBridgeImpl = await HomeBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address);

      const proxyOwner = await storageProxy.proxyOwner()
      const upgradeabilityAdmin = await homeBridge.upgradeabilityAdmin()

      upgradeabilityAdmin.should.be.equal(proxyOwner)
    })
  })
})
