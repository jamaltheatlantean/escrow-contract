import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

describe("Escrow", function () {
    async function deployEscrow() {
        const [depositor, arbiter, beneficiary] = await ethers.getSigners();
        const amount = ethers.utils.parseEther("1");
        const escrowFactory = await ethers.getContractFactory("Escrow");
        const escrow = await escrowFactory.deploy(
            arbiter.address,
            beneficiary.address,
            { value: amount }
        );

        return { escrow, depositor, arbiter, beneficiary, amount };
    }

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            const { escrow, depositor } = await loadFixture(deployEscrow);

            expect(await escrow.getDepositor()).to.equal(depositor.address);
        });

        it("Should set the right arbiter", async function () {
            const { escrow, arbiter } = await loadFixture(deployEscrow);
            expect(await escrow.getArbiter()).to.equal(arbiter.address);
        });

        it("Should set the right beneficiary", async function () {
            const { escrow, beneficiary } = await loadFixture(deployEscrow);
            expect(await escrow.getBeneficiary()).to.equal(beneficiary.address);
        });

        it("Should set the right amount", async function () {
            const { escrow, amount } = await loadFixture(deployEscrow);
            expect(await escrow.getBalance()).to.equal(amount);
        });
    });
    describe("Raise Issue", () => {
        it("Only allow depositor to raise issue", async () => {
            const { escrow, arbiter } = await loadFixture(deployEscrow);
            const tx = escrow.connect(arbiter).raiseIssue("I Don't like this");
            await expect(tx).to.revertedWith("Only depositor can raise issue");
        });
        it("Should set issueRaised to true", async () => {
            const { escrow, depositor } = await loadFixture(deployEscrow);
            await escrow.connect(depositor).raiseIssue("I Don't like this");
            expect(await escrow.isIssueRaised()).to.eq(true);
        });
        it("Should emit an event when issue is raised", async () => {
            const { escrow, depositor } = await loadFixture(deployEscrow);
            const tx = await escrow
                .connect(depositor)
                .raiseIssue("I Don't like this");
            await expect(tx)
                .to.emit(escrow, "IssueRaised")
                .withArgs("I Don't like this");
        });
    });
    describe("Resolve Issue", () => {
        it("Only allow arbiter or depositor to resolve issue", async () => {
            const { escrow, beneficiary, depositor } = await loadFixture(
                deployEscrow
            );
            await escrow.connect(depositor).raiseIssue("I Don't like this");
            await expect(
                escrow.connect(beneficiary).resolveIssue()
            ).to.revertedWith("Only depositor or arbiter can resolve issue");
        });

        it("should allow both arbiter and depositor to resolve issue", async () => {
            const { escrow, depositor, arbiter } = await loadFixture(
                deployEscrow
            );
            await escrow.connect(depositor).raiseIssue("I Don't like this");
            await escrow.connect(depositor).resolveIssue();
            await escrow.connect(depositor).raiseIssue("I Don't like this");
            await escrow.connect(arbiter).resolveIssue();
        });

        it("Should set issueRaised to false", async () => {
            const { escrow, depositor } = await loadFixture(deployEscrow);

            await escrow.connect(depositor).raiseIssue("I Don't like this");
            await escrow.connect(depositor).resolveIssue();
            expect(await escrow.isIssueRaised()).to.eq(false);
        });
        it("Should emit an event when issue is resolved", async () => {
            const { escrow, depositor } = await loadFixture(deployEscrow);

            await escrow.connect(depositor).raiseIssue("I Don't like this");
            await expect(escrow.connect(depositor).resolveIssue()).to.emit(
                escrow,
                "IssueResolved"
            );
        });
    });
    describe("Approve", () => {
        it("should allow  depositor to approve", async () => {
            const { escrow, depositor } = await loadFixture(deployEscrow);
            await escrow.connect(depositor).raiseIssue("I Don't like this");
            await escrow.connect(depositor).resolveIssue();
            await escrow.connect(depositor).approve();
        });
        it("should not allow arbiter to approve", async () => {
            const { escrow, depositor, arbiter } = await loadFixture(
                deployEscrow
            );
            await escrow.connect(depositor).raiseIssue("I Don't like this");
            await escrow.connect(depositor).resolveIssue();
            await escrow.connect(arbiter).approve();
        });
        it("should not allow beneficiary to approve", async () => {
            const { escrow, depositor, beneficiary } = await loadFixture(
                deployEscrow
            );
            await escrow.connect(depositor).raiseIssue("I Don't like this");
            await escrow.connect(depositor).resolveIssue();
            await expect(escrow.connect(beneficiary).approve()).to.revertedWith(
                "Only arbiter or depositor can approve"
            );
        });
        it("should not approve if issue is raised", async () => {
            const { escrow, depositor } = await loadFixture(deployEscrow);
            await escrow.connect(depositor).raiseIssue("I Don't like this");
            await expect(escrow.connect(depositor).approve()).to.revertedWith(
                "Issue is raised cannot approve"
            );
        });
        it("should approve and set isApproved to true", async () => {
            const { escrow, depositor } = await loadFixture(deployEscrow);
            await escrow.connect(depositor).raiseIssue("I Don't like this");
            await escrow.connect(depositor).resolveIssue();
            await escrow.connect(depositor).approve();
            expect(await escrow.isApproved()).to.eq(true);
        });
        it("shoould emit Approved event when approved", async () => {
            const { escrow, depositor, amount } = await loadFixture(
                deployEscrow
            );
            await escrow.connect(depositor).raiseIssue("I Don't like this");
            await escrow.connect(depositor).resolveIssue();
            await expect(escrow.connect(depositor).approve())
                .to.emit(escrow, "Approved")
                .withArgs(depositor.address, amount);
        });
        it("should set amountToWithdraw to amount", async () => {
            const { escrow, depositor, amount } = await loadFixture(
                deployEscrow
            );
            await escrow.connect(depositor).raiseIssue("I Don't like this");
            await escrow.connect(depositor).resolveIssue();
            await escrow.connect(depositor).approve();
            expect(await escrow.amountToWithdraw()).to.eq(amount);
        });
    });
    describe("Withdraw", () => {
        it("should allow beneficiary to withdraw and tranfer Eth", async () => {
            const { escrow, beneficiary, depositor } = await loadFixture(
                deployEscrow
            );
            const beneficiaryBalanceBefore = await beneficiary.getBalance();

            await escrow.connect(depositor).approve();
            const amountToWithdraw = await escrow.amountToWithdraw();
            const txRes = await escrow.connect(beneficiary).withdraw();
            const txReceipt = await txRes.wait(1);
            const gasUsed = txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice);
            const beneficiaryBalanceAfter = await beneficiary.getBalance();
            const expectedBal = beneficiaryBalanceBefore
                .add(amountToWithdraw)
                .sub(gasUsed);

            expect(beneficiaryBalanceAfter).to.eq(expectedBal);
        });
    });
});
