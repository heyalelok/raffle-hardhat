const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const {
    developmentsChains,
    networkConfig,
} = require("../../helper-hardhat-config")
!developmentsChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", async function () {
          let raffle,
              vrfCoordinatorV2Mock,
              raffleEntranceFee,
              deployer,
              accounts,
              player,
              interval
          //   const chainId = network.config.chainId

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              accounts = await ethers.getSigners()
              player = accounts[1]
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle")
              //   raffle = raffleContract.connect(player)
              vrfCoordinatorV2Mock = await ethers.getContract(
                  "VRFCoordinatorV2Mock",
                  deployer
              )
              raffleEntranceFee = await raffle.getEntranceFeed()
              interval = await raffle.getInterval()
          })
          describe("constructor", async function () {
              it("initialized", async function () {
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), "30")
              })
          })
          describe("enterRaffle", async function () {
              it("reverted when you don't pay enought", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle__NotEnoughETHEntered"
                  )
              })
              it("records player when they enter", async function () {
                  await raffle.enterRaffle({
                      value: raffleEntranceFee,
                  })
                  const getPlayer = await raffle.getPlayer(0)
                  assert.equal(getPlayer, deployer)
              })
              it("emits event on enter", async function () {
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee })
                  ).to.emit(raffle, "RaffleEnter")
              })

              it("doesn't allow entrance when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep([])
                  //   console.log(await raffle.getRaffleState())
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee })
                  ).to.be.revertedWith("Raffle__NOTOPEN")
              })
          })

          describe("chekUpkeep", async function () {
              it("returns fales if people haven't send any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(
                      []
                  )
                  assert.equal(!upkeepNeeded, true)
              })
              it("returns false if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x")
                  const raffleState = await raffle.getRaffleState()
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(
                      []
                  )
                  assert.equal(raffleState.toString(), "1")
                  assert.equal(upkeepNeeded, false)
              })
          })
          describe("performUpkeep", async function () {
              it("it can only run checkupkeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  const tx = await raffle.performUpkeep("0x")
                  assert(tx)
              })
              it("reverted when checkupkeep is false ", async function () {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle__UpkeepNotNeeded"
                  )
              })
              it("updates the raffle state,emits and event, and call the vrf coodinator", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await raffle.performUpkeep([])
                  const txReceipt = await txResponse.wait(1)
                  const raffleState = await raffle.getRaffleState()

                  const requestId = txReceipt.events[1].args.requstId

                  assert(requestId.toNumber() > 0)
                  assert(raffleState == 1)
              })
          })
          describe("fulfillRandomWords", async function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ])
                  await network.provider.send("evm_mine", [])
              })
              it("it can only be call after perform", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith("nonexistent request")
              })
              it("picks a winner, resets the lottery and send money", async function () {
                  const additionalEntrants = 3
                  const startingAccountIndex = 1
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i])
                      await accountConnectedRaffle.enterRaffle({
                          value: raffleEntranceFee,
                      })
                  }
                  const startingTimeStamp = await raffle.getLatestTimeStamp()
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("Found The Event!")
                          try {
                              const recentWinner =
                                  await raffle.getRecentWinner()
                              console.log(recentWinner)
                              //   console.log(accounts[0])
                              //   console.log(accounts[1])
                              //   console.log(accounts[2])
                              //   console.log(accounts[3])
                              const raffleState = await raffle.getRaffleState()
                              const endingTimeStamp =
                                  await raffle.getLatestTimeStamp()
                              const numPlayers =
                                  await raffle.getNumberOfPlyaers()
                              const endingBalance =
                                  await accounts[1].getBalance()
                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(raffleState.toString(), "0")
                              assert.equal(
                                  endingBalance.toString(),
                                  startingBalance.add(
                                      raffleEntranceFee
                                          .mul(additionalEntrants)
                                          .add(raffleEntranceFee)
                                          .toString()
                                  )
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                          } catch (error) {
                              reject
                          }
                          resolve()
                      })
                      //   Setting up the listener
                      // below we will fire the event
                      const tx = await raffle.performUpkeep([])
                      const txReceipt = await tx.wait(1)
                      const startingBalance = await accounts[1].getBalance()
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requstId,
                          raffle.address
                      )
                  })
              })
          })
      })
