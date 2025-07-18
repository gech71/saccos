import { getMemberDetails } from './actions';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { User, School, Phone, Home, Shield, PiggyBank, HandCoins, Landmark, Banknote, ReceiptText } from 'lucide-react';

const StatInfo = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: React.ReactNode }) => (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
        <div className="text-primary mt-1">{icon}</div>
        <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-semibold">{value || 'N/A'}</p>
        </div>
    </div>
);

const SectionCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="text-xl text-primary font-headline">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            {children}
        </CardContent>
    </Card>
);

export default async function MemberProfilePage({ params }: { params: { memberId: string } }) {
    const memberDetails = await getMemberDetails(params.memberId);

    if (!memberDetails) {
        notFound();
    }

    const { member, school, address, emergencyContact, savingAccounts, shares, loans, loanRepayments, serviceCharges, monthlySavings, monthlyLoanRepayments } = memberDetails;

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8 bg-background">
            {/* Header Card */}
            <Card className="overflow-hidden shadow-xl">
                <CardHeader className="bg-gradient-to-br from-primary/80 to-accent/80 p-6 flex flex-col md:flex-row items-center gap-6">
                    <Avatar className="h-28 w-28 border-4 border-white shadow-lg">
                        <AvatarImage src={`https://placehold.co/128x128.png?text=${member.fullName.charAt(0)}`} alt={member.fullName} data-ai-hint="user avatar"/>
                        <AvatarFallback><User className="h-16 w-16" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-center md:text-left">
                        <CardTitle className="text-4xl font-headline text-white">{member.fullName}</CardTitle>
                        <CardDescription className="text-lg text-primary-foreground/90 mt-1">{member.email}</CardDescription>
                        <div className="mt-2">
                           <Badge variant={member.status === 'active' ? 'default' : 'destructive'} className="bg-white text-primary-foreground font-bold py-1 px-3 text-sm">{member.status}</Badge>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Personal Information */}
             <SectionCard title="Personal & Contact Information">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   <StatInfo icon={<User className="h-5 w-5"/>} label="Sex" value={member.sex} />
                   <StatInfo icon={<Phone className="h-5 w-5"/>} label="Phone Number" value={member.phoneNumber} />
                   <StatInfo icon={<School className="h-5 w-5"/>} label="School" value={school?.name} />
                   <StatInfo icon={<Home className="h-5 w-5"/>} label="Address" value={`${address?.subCity}, Woreda ${address?.wereda}`} />
                   <StatInfo icon={<Shield className="h-5 w-5"/>} label="Emergency Contact" value={`${emergencyContact?.name} (${emergencyContact?.phone})`} />
                   <StatInfo icon={<User className="h-5 w-5"/>} label="Join Date" value={format(new Date(member.joinDate), 'PPP')} />
                </div>
            </SectionCard>

            {/* Financial Overview */}
            <Tabs defaultValue="savings" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
                    <TabsTrigger value="savings" className="py-3"><PiggyBank className="mr-2"/> Savings</TabsTrigger>
                    <TabsTrigger value="shares" className="py-3"><Landmark className="mr-2"/> Shares</TabsTrigger>
                    <TabsTrigger value="loans" className="py-3"><Banknote className="mr-2"/> Loans</TabsTrigger>
                    <TabsTrigger value="repayments" className="py-3"><HandCoins className="mr-2"/> Repayments</TabsTrigger>
                    <TabsTrigger value="charges" className="py-3"><ReceiptText className="mr-2"/> Charges</TabsTrigger>
                </TabsList>

                <TabsContent value="savings" className="mt-4">
                    <SectionCard title="Savings History">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Month</TableHead>
                                    <TableHead className="text-right">Deposits (Birr)</TableHead>
                                    <TableHead className="text-right">Withdrawals (Birr)</TableHead>
                                    <TableHead className="text-right">Net Change (Birr)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monthlySavings.length > 0 ? monthlySavings.map(s => (
                                    <TableRow key={s.month}>
                                        <TableCell>{s.month}</TableCell>
                                        <TableCell className="text-right text-green-600 font-semibold">{s.deposits.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                        <TableCell className="text-right text-red-600 font-semibold">{s.withdrawals.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                        <TableCell className="text-right font-bold">{s.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={4} className="text-center h-24">No savings history.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </SectionCard>
                </TabsContent>

                <TabsContent value="shares" className="mt-4">
                    <SectionCard title="Share Allocations">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Share Type</TableHead>
                                    <TableHead className="text-right">Count</TableHead>
                                    <TableHead className="text-right">Total Value (Birr)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {shares.length > 0 ? shares.map(s => (
                                    <TableRow key={s.id}>
                                        <TableCell>{format(new Date(s.allocationDate), 'PPP')}</TableCell>
                                        <TableCell>{s.shareTypeName}</TableCell>
                                        <TableCell className="text-right">{s.count}</TableCell>
                                        <TableCell className="text-right font-semibold">{(s.count * s.valuePerShare).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={4} className="text-center h-24">No share allocations found.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </SectionCard>
                </TabsContent>
                
                <TabsContent value="loans" className="mt-4">
                    <SectionCard title="Loan History">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Disbursement Date</TableHead>
                                    <TableHead>Loan Type</TableHead>
                                    <TableHead className="text-right">Principal Amount (Birr)</TableHead>
                                    <TableHead className="text-right">Remaining Balance (Birr)</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loans.length > 0 ? loans.map(loan => (
                                    <TableRow key={loan.id}>
                                        <TableCell>{format(new Date(loan.disbursementDate), 'PPP')}</TableCell>
                                        <TableCell>{loan.loanTypeName}</TableCell>
                                        <TableCell className="text-right">{loan.principalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                        <TableCell className="text-right font-semibold">{loan.remainingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                        <TableCell><Badge variant={loan.status === 'active' ? 'default' : 'secondary'}>{loan.status}</Badge></TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={5} className="text-center h-24">No loan history.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </SectionCard>
                </TabsContent>

                <TabsContent value="repayments" className="mt-4">
                    <SectionCard title="Loan Repayment History">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Month</TableHead>
                                    <TableHead className="text-right">Amount Repaid (Birr)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monthlyLoanRepayments.length > 0 ? monthlyLoanRepayments.map(r => (
                                    <TableRow key={r.month}>
                                        <TableCell>{r.month}</TableCell>
                                        <TableCell className="text-right font-semibold text-green-600">{r.totalRepaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={2} className="text-center h-24">No repayment history.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </SectionCard>
                </TabsContent>

                <TabsContent value="charges" className="mt-4">
                    <SectionCard title="Applied Service Charges">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date Applied</TableHead>
                                    <TableHead>Charge Type</TableHead>
                                    <TableHead className="text-right">Amount (Birr)</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {serviceCharges.length > 0 ? serviceCharges.map(charge => (
                                    <TableRow key={charge.id}>
                                        <TableCell>{format(new Date(charge.dateApplied), 'PPP')}</TableCell>
                                        <TableCell>{charge.serviceChargeTypeName}</TableCell>
                                        <TableCell className="text-right">{charge.amountCharged.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                        <TableCell><Badge variant={charge.status === 'paid' ? 'default' : 'destructive'}>{charge.status}</Badge></TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={4} className="text-center h-24">No service charges found.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </SectionCard>
                </TabsContent>
            </Tabs>
        </div>
    );
}
