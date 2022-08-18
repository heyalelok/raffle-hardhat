const { network, ethers } = require("hardhat")
const {
    developmentsChains,
    networkConfig,
} = require("../helper-hardhat-config")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30")
module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoodinatorV2Address, subscriptionId

    if (chainId == 31337) {
        const VRFCoordinatorV2Mock = await ethers.getContract(
            "VRFCoordinatorV2Mock"
        )
        vrfCoodinatorV2Address = VRFCoordinatorV2Mock.address
        const transactionResponse =
            await VRFCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait()
        subscriptionId = transactionReceipt.events[0].args.subId
        console.log(subscriptionId)
        await VRFCoordinatorV2Mock.fundSubscription(
            subscriptionId.toNumber(),
            VRF_SUB_FUND_AMOUNT
        )
    } else {
        vrfCoodinatorV2Address = networkConfig[chainId]["vrfCoodinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }
    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]
    const args = [
        vrfCoodinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        // waitConfirmations: network.config.blockConfirmations || 1,
    })
    log("Raffle Deployed!")
}
module.exports.tags = ["all", "raffle"]
