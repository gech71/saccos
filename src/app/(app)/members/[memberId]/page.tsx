
import { getMemberDetails, type MemberDetails } from './actions';
import { notFound } from 'next/navigation';
import { PageTitle } from '@/components/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { User, School, Phone, Home, Shield, PiggyBank, HandCoins, Landmark, Banknote, ReceiptText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const StatInfo = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: React.ReactNode }) => (
    <div className="flex items-start gap-4">
        <div className="text-muted-foreground mt-1">{icon}</div>
        <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-semibold">{value || 'N/A'}</p>
        </div>
    </div>
);

export default async function MemberProfilePage({ params }: { params: { memberId: string } }) {
    const memberDetails = await getMemberDetails(params.memberId);

    if (!memberDetails) {
        notFound();
    }

    const { member, school, address, emergencyContact, savingAccounts, shares, loans, loanRepayments, serviceCharges, monthlySavings, monthlyLoanRepayments } = memberDetails;

    return (
        <div className="space-y-8">
            <PageTitle title="Member Profile" subtitle={`A comprehensive overview of ${member.fullName}`} />

            <Card>
                <CardHeader className="flex flex-col md:flex-row items-start gap-6">
                    <Avatar className="h-24 w-24 border-2 border-primary">
                        <AvatarImage src={`https://placehold.co/100x100.png?text=${member.fullName.charAt(0)}`} alt={member.fullName} data-ai-hint="user avatar" />
                        <AvatarFallback><User className="h-12 w-12" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <CardTitle className="text-3xl font-headline text-primary">{member.fullName}</CardTitle>
                        <CardDescription className="text-base">{member.email}</CardDescription>
                        <div className="mt-2">
                           <Badge variant={member.status === 'active' ? 'default' : 'destructive'}>{member.status}</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   <StatInfo icon={<User className="h-5 w-5"/>} label="Sex" value={member.sex} />
                   <StatInfo icon={<Phone className="h-5 w-5"/>} label="Phone Number" value={member.phoneNumber} />
                   <StatInfo icon={<School className="h-5 w-5"/>} label="School" value={school?.name} />
                   <StatInfo icon={<Home className="h-5 w-5"/>} label="Address" value={`${address?.subCity}, Woreda ${address?.wereda}`} />
                   <StatInfo icon={<Shield className="h-5 w-5"/>} label="Emergency Contact" value={`${emergencyContact?.name} (${emergencyContact?.phone})`} />
                   <StatInfo icon={<User className="h-5 w-5"/>} label="Join Date" value={format(new Date(member.joinDate), 'PPP')} />
                </CardContent>
            </Card>

            <Tabs defaultValue="savings">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
                    <TabsTrigger value="savings"><PiggyBank className="mr-2"/> Savings</TabsTrigger>
                    <TabsTrigger value="shares"><Landmark className="mr-2"/> Shares</TabsTrigger>
                    <TabsTrigger value="loans"><Banknote className="mr-2"/> Loans</TabsTrigger>
                    <TabsTrigger value="repayments"><HandCoins className="mr-2"/> Repayments</TabsTrigger>
                    <TabsTrigger value="charges"><ReceiptText className="mr-2"/> Charges</TabsTrigger>
                </TabsList>

                <TabsContent value="savings">
                    <Card>
                        <CardHeader><CardTitle>Savings History</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Month</TableHead>
                                        <TableHead className="text-right">Deposits</TableHead>
                                        <TableHead className="text-right">Withdrawals</TableHead>
                                        <TableHead className="text-right">Net</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {monthlySavings.map(s => (
                                        <TableRow key={s.month}>
                                            <TableCell>{s.month}</TableCell>
                                            <TableCell className="text-right text-green-600">{s.deposits.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                            <TableCell className="text-right text-red-600">{s.withdrawals.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                            <TableCell className="text-right font-semibold">{s.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="shares">
                    <Card>
                        <CardHeader><CardTitle>Share Allocations</CardTitle></CardHeader>
                         <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Share Type</TableHead>
                                        <TableHead className="text-right">Count</TableHead>
                                        <TableHead className="text-right">Total Value</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shares.map(s => (
                                        <TableRow key={s.id}>
                                            <TableCell>{format(new Date(s.allocationDate), 'PPP')}</TableCell>
                                            <TableCell>{s.shareTypeName}</TableCell>
                                            <TableCell className="text-right">{s.count}</TableCell>
                                            <TableCell className="text-right font-semibold">{(s.count * s.valuePerShare).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="loans">
                    <Card>
                        <CardHeader><CardTitle>Loan History</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Disbursement Date</TableHead>
                                        <TableHead>Loan Type</TableHead>
                                        <TableHead className="text-right">Principal Amount</TableHead>
                                        <TableHead className="text-right">Remaining Balance</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loans.map(loan => (
                                        <TableRow key={loan.id}>
                                            <TableCell>{format(new Date(loan.disbursementDate), 'PPP')}</TableCell>
                                            <TableCell>{loan.loanTypeName}</TableCell>
                                            <TableCell className="text-right">{loan.principalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                            <TableCell className="text-right font-semibold">{loan.remainingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                            <TableCell><Badge variant={loan.status === 'active' ? 'default' : 'secondary'}>{loan.status}</Badge></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="repayments">
                     <Card>
                        <CardHeader><CardTitle>Loan Repayment History</CardTitle></CardHeader>
                         <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Month</TableHead>
                                        <TableHead className="text-right">Amount Repaid</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {monthlyLoanRepayments.map(r => (
                                        <TableRow key={r.month}>
                                            <TableCell>{r.month}</TableCell>
                                            <TableCell className="text-right font-semibold text-green-600">{r.totalRepaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="charges">
                     <Card>
                        <CardHeader><CardTitle>Applied Service Charges</CardTitle></CardHeader>
                         <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date Applied</TableHead>
                                        <TableHead>Charge Type</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {serviceCharges.map(charge => (
                                        <TableRow key={charge.id}>
                                            <TableCell>{format(new Date(charge.dateApplied), 'PPP')}</TableCell>
                                            <TableCell>{charge.serviceChargeTypeName}</TableCell>
                                            <TableCell className="text-right">{charge.amountCharged.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                            <TableCell><Badge variant={charge.status === 'paid' ? 'default' : 'destructive'}>{charge.status}</Badge></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>
        </div>
    );
}
