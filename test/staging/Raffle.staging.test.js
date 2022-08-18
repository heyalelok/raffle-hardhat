const { expect, assert } = require("chai")
const { deployments, ethers, getNamedAccounts, network } = require("hardhat")
const { developmentsChains } = require("../../helper-hardhat-config")

developmentsChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Test", async function () {
          let raffle, deployer, raffleEntranceFee
          // const chainId = network.config.chainId
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              raffle = await ethers.getContract("Raffle", deployer)
              raffleEntranceFee = await raffle.getEntranceFeed()
          })
          describe("fulfillRandomWords", async function () {
              it("works with live Chainlink keepers and chainlink VRF we get a random winner", async function () {
                  const startingTimeStamp = await raffle.getLatestTimeStamp()
                  const accounts = await ethers.getSigners()
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("WinnerPicked")

                          try {
                              const recentWinner =
                                  await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const endingBalance =
                                  await accounts[0].getBalance()
                              const endingTimeStamp =
                                  await raffle.getLatestTimeStamp()
                              await expect(raffle.getPlayer(0)).to.be.reverted
                              assert.equal(
                                  recentWinner.toString(),
                                  accounts[0].address
                              )
                              assert.equal(raffleState, 0)
                              assert.equal(
                                  endingBalance.toString(),
                                  startingBalance
                                      .add(raffleEntranceFee)
                                      .toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (error) {
                              reject(error)
                          }
                      })
                      //   Then entering the raffle
                      const tx = await raffle.enterRaffle({
                          value: raffleEntranceFee,
                      })
                      tx.wait(1)
                      const startingBalance = await accounts[0].getBalance()
                      // and this code wont complete until our listener has finished listening!
                  })
              })
          })
      })
