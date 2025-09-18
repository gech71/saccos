

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import type { School, ShareType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Filter, SchoolIcon, Edit, ListChecks, DollarSign, Banknote, Wallet, ReceiptText, FileDown, Loader2, PiggyBank, PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { exportToExcel } from '@/lib/utils';
import { FileUpload } from '@/components/file-upload';
import { getOverduePaymentsPageData, recordOverduePayment, type OverduePageData, type OverdueMemberInfo, type OverduePaymentInput } from './actions';
import { useAuth } from '@/contexts/auth-context';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface PaymentFormState {
  savingsAmount: number;
  shareAmounts: Record<string, number>; 
  serviceChargeAmount: number;
  date: string;
  depositMode: 'Cash' | 'Bank' | 'Wallet';
  paymentDetails: {
    sourceName: string;
    transactionReference: string;
    evidenceUrl: string;
  };
}

const initialPaymentFormState: PaymentFormState = {
  savingsAmount: 0,
  shareAmounts: {},
  serviceChargeAmount: 0,
  date: new Date().toISOString().split('T')[0],
  depositMode: 'Cash',
  paymentDetails: {
    sourceName: '',
    transactionReference: '',
    evidenceUrl: '',
  },
};

export default function OverduePaymentsPage() {
  const [pageData, setPageData] = useState<OverduePageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const { toast } = useToast();
  const { user } = useAuth();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedOverdueMemberForPayment, setSelectedOverdueMemberForPayment] = useState<OverdueMemberInfo | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(initialPaymentFormState);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const canCreate = useMemo(() => user?.permissions.includes('overduePayment:create'), [user]);

  const fetchPageData = async () => {
      setIsLoading(true);
      try {
          const data = await getOverduePaymentsPageData();
          setPageData(data);
      } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to load overdue payment data.' });
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    fetchPageData();
  }, [toast]);

  const filteredOverdueMembers = useMemo(() => {
    if (!pageData) return [];
    return pageData.overdueMembers.filter(member => {
      const matchesSearchTerm = member.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || member.schoolId === selectedSchoolFilter;
      return matchesSearchTerm && matchesSchoolFilter;
    });
  }, [pageData, searchTerm, selectedSchoolFilter]);
  
  const paginatedOverdueMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredOverdueMembers.slice(startIndex, endIndex);
  }, [filteredOverdueMembers, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredOverdueMembers.length / rowsPerPage);
  }, [filteredOverdueMembers.length, rowsPerPage]);

  
  const handleOpenPaymentModal = (member: OverdueMemberInfo) => {
    setSelectedOverdueMemberForPayment(member);
    const initialShareAmounts: Record<string, number> = {};
    member.overdueSharesDetails.forEach(detail => {
        initialShareAmounts[detail.shareTypeId] = detail.overdueAmount;
    });
    setPaymentForm({
        savingsAmount: member.overdueSavingsAmount,
        shareAmounts: initialShareAmounts,
        serviceChargeAmount: member.totalOverdueServiceCharges,
        date: new Date().toISOString().split('T')[0],
        depositMode: 'Cash',
        paymentDetails: { sourceName: '', transactionReference: '', evidenceUrl: '' },
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentFormInputChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string, shareTypeId?: string) => {
    const { value } = e.target;
    const numericValue = parseFloat(value) || 0;

    if (fieldName === 'savingsAmount') {
      setPaymentForm(prev => ({ ...prev, savingsAmount: numericValue }));
    } else if (fieldName === 'serviceChargeAmount') {
      setPaymentForm(prev => ({ ...prev, serviceChargeAmount: numericValue }));
    } else if (fieldName === 'shareAmount' && shareTypeId) {
      setPaymentForm(prev => ({
        ...prev,
        shareAmounts: { ...prev.shareAmounts, [shareTypeId]: numericValue },
      }));
    } else if (fieldName === 'date') {
      setPaymentForm(prev => ({ ...prev, date: value }));
    } else if (fieldName.startsWith('paymentDetails.')) {
      const detailKey = fieldName.split('.')[1] as keyof PaymentFormState['paymentDetails'];
      setPaymentForm(prev => ({
        ...prev,
        paymentDetails: { ...prev.paymentDetails, [detailKey]: value },
      }));
    }
  };
  
  const handlePaymentDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setPaymentForm(prev => ({ ...prev, depositMode: value }));
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOverdueMemberForPayment) return;

    const { savingsAmount, shareAmounts, serviceChargeAmount, date, depositMode, paymentDetails } = paymentForm;
    const totalPaymentMade = savingsAmount + Object.values(shareAmounts).reduce((sum, amt) => sum + amt, 0) + serviceChargeAmount;

    if (totalPaymentMade <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Total payment amount must be positive.' });
      return;
    }
    if ((depositMode === 'Bank' || depositMode === 'Wallet') && !paymentDetails.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${depositMode} Name.` });
        return;
    }
    
    setIsSubmitting(true);
    try {
        const paymentData: OverduePaymentInput = {
            memberId: selectedOverdueMemberForPayment.memberId,
            memberName: selectedOverdueMemberForPayment.fullName,
            savingsAmount,
            shareAmounts,
            serviceChargeAmount,
            paymentDate: date,
            depositMode,
            paymentDetails: depositMode === 'Cash' ? undefined : paymentDetails,
        }
        await recordOverduePayment(paymentData);
        toast({ title: 'Success', description: `Payment transactions for ${selectedOverdueMemberForPayment.fullName} submitted for approval.` });
        setIsPaymentModalOpen(false);
        await fetchPageData(); // Refresh the data
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to record payment.' });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const totalOverdueSavings = useMemo(() => {
    return filteredOverdueMembers.reduce((sum, member) => sum + member.overdueSavingsAmount, 0);
  }, [filteredOverdueMembers]);

  const totalOverdueSharesValue = useMemo(() => {
    return filteredOverdueMembers.reduce((sum, member) => {
      return sum + member.overdueSharesDetails.reduce((shareSum, detail) => shareSum + detail.overdueAmount, 0);
    }, 0);
  }, [filteredOverdueMembers]);

  const totalOverdueServiceChargesGlobal = useMemo(() => {
    return filteredOverdueMembers.reduce((sum, member) => sum + member.totalOverdueServiceCharges, 0);
  }, [filteredOverdueMembers]);

  const handleExport = () => {
    const dataToExport = filteredOverdueMembers.map(member => ({
        'Member Name': member.fullName,
        'School': member.schoolName,
        'Overdue Savings (Birr)': member.overdueSavingsAmount.toFixed(2),
        'Total Overdue Shares (Birr)': member.overdueSharesDetails.reduce((sum, d) => sum + d.overdueAmount, 0).toFixed(2),
        'Overdue Shares Details': member.overdueSharesDetails.map(d => `${d.shareTypeName}: ${d.overdueAmount.toFixed(2)} Birr`).join('; '),
        'Overdue Service Charges (Birr)': member.totalOverdueServiceCharges.toFixed(2),
        'Pending Service Charges': member.pendingServiceCharges.map(sc => `${sc.serviceChargeTypeName}: ${sc.amountCharged.toFixed(2)} Birr`).join('; '),
    }));
    exportToExcel(dataToExport, 'overdue_payments_export');
  };

  if (isLoading || !pageData) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Overdue Payments" subtitle="Track and manage members with outstanding savings, share contributions, or service charges.">
        <Button onClick={handleExport} variant="outline" disabled={filteredOverdueMembers.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Export
        </Button>
      </PageTitle>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Members with Overdue</CardTitle>
                <ListChecks className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">{filteredOverdueMembers.length}</div>
            </CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Overdue Savings</CardTitle>
                <DollarSign className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">{totalOverdueSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</div>
            </CardContent>
        </Card>
         <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Overdue Shares Value</CardTitle>
                <DollarSign className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">{totalOverdueSharesValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</div>
            </CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Overdue Service Charges</CardTitle>
                <ReceiptText className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">{totalOverdueServiceChargesGlobal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</div>
            </CardContent>
        </Card>
      </div>


      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by member name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
            aria-label="Search overdue members"
          />
        </div>
        <Select value={selectedSchoolFilter} onValueChange={setSelectedSchoolFilter}>
          <SelectTrigger className="w-full sm:w-[220px]" aria-label="Filter by school">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground md:hidden" />
            <SchoolIcon className="mr-2 h-4 w-4 text-muted-foreground hidden md:inline" />
            <SelectValue placeholder="Filter by school" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {pageData.schools.map(school => (
              <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <Accordion type="multiple" className="w-full space-y-2">
        {isLoading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : paginatedOverdueMembers.length > 0 ? paginatedOverdueMembers.map(member => {
            const totalOverdue = member.overdueSavingsAmount + member.overdueSharesDetails.reduce((sum, d) => sum + d.overdueAmount, 0) + member.totalOverdueServiceCharges;
            return (
                <AccordionItem value={member.memberId} key={member.memberId} className="border-b-0">
                    <Card className="shadow-sm">
                        <AccordionTrigger className="p-4 hover:no-underline [&[data-state=open]]:border-b">
                           <div className="flex-1 text-left flex flex-col md:flex-row md:items-center gap-2 md:gap-4 w-full">
                                <div className="font-medium flex-1 min-w-0 truncate">{member.fullName}</div>
                                <div className="text-sm text-muted-foreground flex-1 min-w-0 truncate">{member.schoolName}</div>
                                <div className="font-semibold text-destructive flex-1 min-w-0 truncate text-right md:text-left">
                                    Total Overdue: {totalOverdue.toLocaleString(undefined, { minimumFractionDigits: 2 })} Birr
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-6 pt-0">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {member.overdueSavingsAmount > 0 && (
                                    <Card>
                                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><PiggyBank className="h-5 w-5 text-primary"/> Overdue Savings</CardTitle></CardHeader>
                                        <CardContent>
                                            <p className="text-2xl font-bold text-destructive">{member.overdueSavingsAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</p>
                                        </CardContent>
                                    </Card>
                                )}
                                {member.overdueSharesDetails.length > 0 && (
                                    <Card>
                                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><PieChart className="h-5 w-5 text-primary"/> Overdue Shares</CardTitle></CardHeader>
                                        <CardContent>
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {member.overdueSharesDetails.map(detail => (
                                                        <TableRow key={detail.shareTypeId}><TableCell>{detail.shareTypeName}</TableCell><TableCell className="text-right font-medium text-destructive">{detail.overdueAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                )}
                                 {member.totalOverdueServiceCharges > 0 && (
                                    <Card>
                                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary"/> Overdue Service Charges</CardTitle></CardHeader>
                                        <CardContent>
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {member.pendingServiceCharges.map(charge => (
                                                         <TableRow key={charge.id}><TableCell>{charge.serviceChargeTypeName}</TableCell><TableCell className="text-right font-medium text-destructive">{charge.amountCharged.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                            {canCreate && (
                                <div className="mt-4 flex justify-end">
                                    <Button size="sm" onClick={() => handleOpenPaymentModal(member)}>
                                        <Edit className="mr-2 h-4 w-4"/> Record Payment
                                    </Button>
                                </div>
                            )}
                        </AccordionContent>
                    </Card>
                </AccordionItem>
            );
        }) : (
            <div className="p-12 text-center text-muted-foreground">No overdue payments found.</div>
        )}
      </Accordion>

      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">Record Payment for {selectedOverdueMemberForPayment?.fullName}</DialogTitle>
            <DialogDescription>
              Enter payment amounts for overdue savings, shares, and/or service charges. Payments will be submitted for approval.
            </DialogDescription>
          </DialogHeader>
          {selectedOverdueMemberForPayment && (
            <form onSubmit={handleSubmitPayment} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
              
              {selectedOverdueMemberForPayment.overdueSavingsAmount > 0 && (
                <div className="p-3 border rounded-md bg-background shadow-sm">
                  <Label htmlFor="savingsAmount" className="font-semibold text-primary">Savings Payment</Label>
                  <p className="text-xs text-muted-foreground mb-1">Currently Overdue: {selectedOverdueMemberForPayment.overdueSavingsAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</p>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="savingsAmount" 
                        name="savingsAmount" 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        value={paymentForm.savingsAmount || ''} 
                        onChange={(e) => handlePaymentFormInputChange(e, 'savingsAmount')} 
                        className="pl-7"
                    />
                  </div>
                </div>
              )}

              {selectedOverdueMemberForPayment.overdueSharesDetails.length > 0 && (
                <div className="space-y-3 p-3 border rounded-md bg-background shadow-sm">
                  <Label className="font-semibold text-primary">Share Payments</Label>
                  {selectedOverdueMemberForPayment.overdueSharesDetails.map(detail => (
                    <div key={detail.shareTypeId} className="ml-1 pl-2 border-l-2 border-accent/50">
                      <Label htmlFor={`shareAmount-${detail.shareTypeId}`}>{detail.shareTypeName}</Label>
                      <p className="text-xs text-muted-foreground mb-1">Currently Overdue: {detail.overdueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</p>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={`shareAmount-${detail.shareTypeId}`}
                          name="shareAmount"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={paymentForm.shareAmounts[detail.shareTypeId] || ''}
                          onChange={(e) => handlePaymentFormInputChange(e, 'shareAmount', detail.shareTypeId)}
                          className="pl-7"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedOverdueMemberForPayment.totalOverdueServiceCharges > 0 && (
                 <div className="p-3 border rounded-md bg-background shadow-sm">
                  <Label htmlFor="serviceChargeAmount" className="font-semibold text-primary">Service Charge Payment</Label>
                  <p className="text-xs text-muted-foreground mb-1">Currently Overdue: {selectedOverdueMemberForPayment.totalOverdueServiceCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</p>
                  <div className="relative">
                    <ReceiptText className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="serviceChargeAmount" 
                        name="serviceChargeAmount" 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        value={paymentForm.serviceChargeAmount || ''} 
                        onChange={(e) => handlePaymentFormInputChange(e, 'serviceChargeAmount')} 
                        className="pl-7"
                    />
                  </div>
                </div>
              )}
              
              <Separator className="my-4"/>

              <div className="grid grid-cols-1 gap-4">
                 <div>
                    <Label htmlFor="date">Payment Date <span className="text-destructive">*</span></Label>
                    <Input id="date" name="date" type="date" value={paymentForm.date} onChange={(e) => handlePaymentFormInputChange(e, 'date')} required />
                </div>
              </div>

              <div>
                <Label>Deposit Mode</Label>
                <RadioGroup value={paymentForm.depositMode} onValueChange={handlePaymentDepositModeChange} className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="payCash" /><Label htmlFor="payCash">Cash</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="payBank" /><Label htmlFor="payBank">Bank</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="Wallet" id="payWallet" /><Label htmlFor="payWallet">Wallet</Label></div>
                </RadioGroup>
              </div>

              {(paymentForm.depositMode === 'Bank' || paymentForm.depositMode === 'Wallet') && (
                <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
                    <div>
                      <Label htmlFor="paymentDetails.sourceName">{paymentForm.depositMode} Name <span className="text-destructive">*</span></Label>
                       <div className="relative">
                        {paymentForm.depositMode === 'Bank' && <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                        {paymentForm.depositMode === 'Wallet' && <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                        <Input id="paymentDetails.sourceName" name="paymentDetails.sourceName" placeholder={`Enter ${paymentForm.depositMode} Name`} value={paymentForm.paymentDetails.sourceName} onChange={(e) => handlePaymentFormInputChange(e, 'paymentDetails.sourceName')} className="pl-8" />
                       </div>
                    </div>
                    <div>
                      <Label htmlFor="paymentDetails.transactionReference">Transaction Reference</Label>
                      <Input id="paymentDetails.transactionReference" name="paymentDetails.transactionReference" placeholder="e.g., TRN123XYZ" value={paymentForm.paymentDetails.transactionReference} onChange={(e) => handlePaymentFormInputChange(e, 'paymentDetails.transactionReference')} />
                    </div>
                  </div>
                  <div className="pl-3">
                    <FileUpload
                        id="overduePaymentEvidence"
                        label="Evidence Attachment"
                        value={paymentForm.paymentDetails.evidenceUrl}
                        onValueChange={(newValue) => {
                            setPaymentForm(prev => ({
                                ...prev,
                                paymentDetails: {
                                    ...prev.paymentDetails,
                                    evidenceUrl: newValue,
                                }
                            }));
                        }}
                    />
                  </div>
                </div>
              )}

              <DialogFooter className="pt-6">
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Payment for Approval
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
