# AcademInvest - User Acceptance Testing (UAT)

## 1. Introduction

This document contains a consolidated list of test cases for the User Acceptance Testing (UAT) of the AcademInvest Saccos Management System. The purpose is to validate that all system functionalities meet the required specifications.

## 2. Test Cases

| No. | Test Case                                                     | Test Case Type | Expected Result                                                          | Actual Result | Pass | Failed | Not Tested | Showstopper, Critical, Nice to have |
|:----|:--------------------------------------------------------------|:---------------|:-------------------------------------------------------------------------|:--------------|:-----|:-------|:-----------|:------------------------------------|
| **Authentication** |
| 1   | **(Positive)** Successful Admin Login                         | Positive       | User is logged in and redirected to the Admin Dashboard.                 |               |      |        |            |                                     |
| 2   | **(Positive)** Successful Member Login                        | Positive       | User is logged in and redirected to their Member Profile.                |               |      |        |            |                                     |
| 3   | **(Positive)** New Member forced password change on first login | Positive       | User is redirected to the "Change Password" page and can set a new password. |               |      |        |            |                                     |
| 4   | **(Negative)** Invalid Admin Password                         | Negative       | An "Incorrect password" error message is displayed.                      |               |      |        |            |                                     |
| 5   | **(Negative)** Non-existent Admin User                        | Negative       | A "User not found" error message is displayed.                           |               |      |        |            |                                     |
| 6   | **(Positive)** Successful Logout                              | Positive       | User is logged out and redirected to the login page.                     |               |      |        |            |                                     |
| **Member Management (Admin)** |
| 7   | **(Positive)** View Member List                               | Positive       | A table of all members is displayed correctly.                           |               |      |        |            |                                     |
| 8   | **(Positive)** Add a New Member                               | Positive       | The new member appears in the member list with a temporary password.     |               |      |        |            |                                     |
| 9   | **(Negative)** Add Member with Duplicate ID                   | Negative       | An error message "Member ID already exists" is displayed.                |               |      |        |            |                                     |
| 10  | **(Positive)** Edit an Existing Member                        | Positive       | The member's information is updated in the list.                         |               |      |        |            |                                     |
| 11  | **(Positive)** Filter Members by School                       | Positive       | The table updates to show only members from the selected school.         |               |      |        |            |                                     |
| 12  | **(Positive)** Search for a Member by Name/ID                 | Positive       | The table updates to show only the matching member(s).                   |               |      |        |            |                                     |
| **Savings & Transactions** |
| 13  | **(Positive)** Record a Savings Deposit                       | Positive       | The new deposit appears in the "Approve Transactions" list.              |               |      |        |            |                                     |
| 14  | **(Positive)** Approve a Savings Deposit                      | Positive       | The transaction is approved and the member's balance is updated.         |               |      |        |            |                                     |
| 15  | **(Negative)** Reject a Savings Deposit                       | Negative       | The transaction is rejected and the member's balance is not affected.    |               |      |        |            |                                     |
| 16  | **(Negative)** Attempt Withdrawal Exceeding Balance           | Negative       | An error "Withdrawal amount cannot exceed balance" is displayed.         |               |      |        |            |                                     |
| 17  | **(Positive)** Generate Account Statement                     | Positive       | A correct statement is generated for the selected member and date range. |               |      |        |            |                                     |
| **Loan Management** |
| 18  | **(Positive)** Create a New Loan Application                  | Positive       | The new loan appears in "Approve Transactions".                          |               |      |        |            |                                     |
| 19  | **(Negative)** Create Loan Exceeding Limit                    | Negative       | An error message indicates the amount is out of range.                   |               |      |        |            |                                     |
| 20  | **(Positive)** Approve a Loan Application                     | Positive       | The loan status changes to "active".                                     |               |      |        |            |                                     |
| 21  | **(Positive)** Record a Loan Repayment                        | Positive       | The loan's remaining balance is correctly reduced.                       |               |      |        |            |                                     |
| 22  | **(Positive)** View Overdue Loans List                        | Positive       | A list of all overdue loans is displayed correctly.                      |               |      |        |            |                                     |
| **System Configuration** |
| 23  | **(Positive)** Create Saving Account Type                     | Positive       | The new account type appears in the list.                                |               |      |        |            |                                     |
| 24  | **(Positive)** Create Share Type                              | Positive       | The new share type appears in the list.                                  |               |      |        |            |                                     |
| 25  | **(Positive)** Create Loan Type                               | Positive       | The new loan type appears in the list.                                   |               |      |        |            |                                     |
| 26  | **(Positive)** Create Service Charge Type                     | Positive       | The new service charge type appears in the list.                         |               |      |        |            |                                     |
| 27  | **(Negative)** Delete a Configuration Type in Use             | Negative       | An error message prevents deletion of a type assigned to any member.     |               |      |        |            |                                     |
| **Financial Calculations** |
| 28  | **(Positive)** Calculate Savings Interest                     | Positive       | A table shows the correct calculated interest for eligible members.      |               |      |        |            |                                     |
| 29  | **(Positive)** Post Savings Interest for Approval             | Positive       | Interest amounts appear as pending transactions in "Approve Transactions". |               |      |        |            |                                     |
| 30  | **(Positive)** Calculate Loan Interest                        | Positive       | A table shows the correct calculated interest for active loans.          |               |      |        |            |                                     |
| 31  | **(Positive)** Post Loan Interest as Service Charges          | Positive       | Interest amounts appear as pending service charges for each member.      |               |      |        |            |                                     |
| **Reports & Forecasts** |
| 32  | **(Positive)** Generate a Savings Report                      | Positive       | The report generates with correct data and columns.                      |               |      |        |            |                                     |
| 33  | **(Positive)** Generate a Loan Report                         | Positive       | The report generates with correct data and columns.                      |               |      |        |            |                                     |
| 34  | **(Positive)** Generate Collection Forecast                   | Positive       | A table appears with members and their expected contribution amounts.    |               |      |        |            |                                     |
| 35  | **(Positive)** Export any Report to Excel                     | Positive       | A valid Excel file is downloaded with the correct report data.           |               |      |        |            |                                     |
| **Aggregate Collections** |
| 36  | **(Positive)** Load Data for a School and Month               | Positive       | A table appears with members and pre-filled expected payment amounts.    |               |      |        |            |                                     |
| 37  | **(Positive)** Submit Aggregate Collection                    | Positive       | The submitted amounts appear as individual pending transactions.         |               |      |        |            |                                     |
| 38  | **(Positive)** Export/Import Collection Sheet                 | Positive       | Exporting and re-importing the sheet correctly updates on-screen values. |               |      |        |            |                                     |
