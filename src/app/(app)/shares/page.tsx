

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import {
  PlusCircle,
  Search,
  Filter,
  DollarSign,
  Banknote,
  Wallet,
  Check,
  ChevronsUpDown,
  FileDown,
  Loader2,
  List,
  AlertTriangle,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle as ShadcnCardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { exportToExcel } from '@/lib/utils';
import { FileUpload } from '@/components/file-upload';
import { getSharePaymentsPageData, addSharePayment, type SharePaymentsPageData, type SharePaymentInput, type MemberCommitmentWithDetails } from './actions';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

const initialPaymentFormState: Partial<SharePaymentInput> = {
  commitmentId: '',
  amount: 0,
  paymentDate: new Date().toISOString().split('T')[0],
  depositMode: 'Cash',
  sourceName: '',
  transactionReference: '',
  evidenceUrl: '',
};

export default function SharePaymentsPage() {
  const [pageData, setPageData] = useState<SharePaymentsPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPayment, setCurrentPayment] = useState<Partial<SharePaymentInput>>(initialPaymentFormState);
  const [openCommitmentCombobox, setOpenCommitmentCombobox] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'paid_off' | 'refunded'>('all');
  const { toast } = useToast();

  const fetchPageData = async () => {
    setIsLoading(true);
    try {
      const data = await getSharePaymentsPageData();
      setPageData(data);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load page data.' });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchPageData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentPayment(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
  };

  const handleSelectChange = (name: keyof SharePaymentInput, value: string) => {
    setCurrentPayment(prev => ({ ...prev, [name]: value }));
  };
  
  const handleDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setCurrentPayment(prev => ({ ...prev, depositMode: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPayment.commitmentId || !currentPayment.amount || currentPayment.amount <= 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a commitment and enter a valid payment amount.' });
        return;
    }
    if ((currentPayment.depositMode === 'Bank' || currentPayment.depositMode === 'Wallet') && !currentPayment.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${currentPayment.depositMode} Name.` });
        return;
    }
    
    setIsSubmitting(true);
    try {
        await addSharePayment(currentPayment as SharePaymentInput);
        toast({ title: 'Submitted for Approval', description: `Share payment submitted.` });
        await fetchPageData();
        setIsModalOpen(false);
    } catch(error) {
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
    } finally {
        setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setCurrentPayment(initialPaymentFormState);
    setIsModalOpen(true);
  };

  const filteredCommitments = useMemo(() => {
    if (!pageData) return [];
    return pageData.commitments.filter(commitment => {
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearchTerm = commitment.member.fullName.toLowerCase().includes(searchTermLower);
      const matchesFilter = filter === 'all' || commitment.status.toLowerCase() === filter;
      return matchesSearchTerm && matchesFilter;
    });
  }, [pageData, searchTerm, filter]);

  const { totalCommitted, totalPaid } = useMemo(() => {
    if (!filteredCommitments) return { totalCommitted: 0, totalPaid: 0 };
    const totalCommitted = filteredCommitments.reduce((sum, c) => sum + c.totalCommittedAmount, 0);
    const totalPaid = filteredCommitments.reduce((sum, c) => sum + c.amountPaid, 0);
    return { totalCommitted, totalPaid };
  }, [filteredCommitments]);
  
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'ACTIVE': return 'default';
        case 'PAID_OFF': return 'secondary';
        case 'REFUNDED': return 'destructive';
        default: return 'outline';
    }
  };

  const handleExport = () => {
    if (!pageData) return;
    const dataToExport = filteredCommitments.map(c => {
      return {
        'Member Name': c.member.fullName,
        'Share Type': c.shareType.name,
        'Status': c.status,
        'Total Committed (Birr)': c.totalCommittedAmount,
        'Amount Paid (Birr)': c.amountPaid,
        'Remaining Balance (Birr)': c.totalCommittedAmount - c.amountPaid,
        'Expected Monthly Payment (Birr)': c.shareType.monthlyPayment?.toFixed(2) || 'N/A',
      };
    });
    exportToExcel(dataToExport, 'share_commitments_export');
  };
  
  const selectedCommitment = useMemo(() => {
    return pageData?.commitments.find(c => c.id === currentPayment.commitmentId);
  }, [pageData, currentPayment.commitmentId]);

  const isUnderpayment = useMemo(() => {
    if (!selectedCommitment || !currentPayment.amount) return false;
    const expectedPayment = selectedCommitment.shareType.monthlyPayment || 0;
    return expectedPayment > 0 && currentPayment.amount < expectedPayment;
  }, [selectedCommitment, currentPayment.amount]);


  return (
    <div className="space-y-6">
      <PageTitle title={"Share Payments & Commitments"} subtitle={"Record member share payments and track their commitments."}>
        <Button onClick={handleExport} variant="outline" disabled={isLoading}>
            <FileDown className="mr-2 h-4 w-4" /> Export Commitments
        </Button>
        <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow" disabled={isLoading}>
          <PlusCircle className="mr-2 h-5 w-5" /> Record Share Payment
        </Button>
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Committed Value (in view)</ShadcnCardTitle>
                <DollarSign className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">{totalCommitted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</div>
            </CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Paid (in view)</ShadcnCardTitle>
                <DollarSign className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</div>
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
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-full sm:w-[220px]">
                <List className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paid_off">Paid Off</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
      </div>
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Share Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
              <TableHead className="text-right">Amount Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="w-[200px]">Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredCommitments.length > 0 ? filteredCommitments.map(c => {
                const balance = c.totalCommittedAmount - c.amountPaid;
                const progress = c.totalCommittedAmount > 0 ? (c.amountPaid / c.totalCommittedAmount) * 100 : 0;
              return (
                <TableRow key={c.id} data-state={c.status !== 'ACTIVE' ? 'completed' : 'pending'}>
                  <TableCell className="font-medium">{c.member.fullName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.shareType.name}</Badge>
                    {c.shareType.monthlyPayment && <div className="text-xs text-muted-foreground mt-1">Exp: {c.shareType.monthlyPayment.toFixed(2)}/mo</div>}
                  </TableCell>
                  <TableCell><Badge variant={getStatusBadgeVariant(c.status)}>{c.status}</Badge></TableCell>
                  <TableCell className="text-right">{c.totalCommittedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right text-green-600">{c.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-semibold">{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                      <Progress value={progress} className="h-2" />
                      <span className="text-xs text-muted-foreground">{progress.toFixed(1)}%</span>
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No share commitments found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline">Record Share Payment</DialogTitle>
            <DialogDescription>
              Select a member's commitment and enter the payment details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="commitmentId">Member's Share Commitment</Label>
              <Popover open={openCommitmentCombobox} onOpenChange={setOpenCommitmentCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    id="commitmentId"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {selectedCommitment
                      ? `${selectedCommitment.member.fullName} - ${selectedCommitment.shareType.name}`
                      : "Select commitment..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search commitment..." />
                    <CommandList>
                      <CommandEmpty>No commitments found.</CommandEmpty>
                      <CommandGroup>
                        {pageData?.commitments.filter(c => c.status === 'ACTIVE').map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.member.fullName} ${c.shareType.name}`}
                            onSelect={() => {
                              handleSelectChange('commitmentId', c.id);
                              setOpenCommitmentCombobox(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", currentPayment.commitmentId === c.id ? "opacity-100" : "opacity-0")} />
                            {c.member.fullName} - {c.shareType.name} (Bal: {(c.totalCommittedAmount - c.amountPaid).toFixed(2)})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {selectedCommitment?.shareType.monthlyPayment && (
                <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
                    <p>Expected Monthly Payment: <strong className="text-primary text-base">{(selectedCommitment.shareType.monthlyPayment || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} Birr</strong></p>
                </div>
            )}
            <div>
              <Label htmlFor="amount">Payment Amount</Label>
              <Input 
                  id="amount" 
                  name="amount" 
                  type="number" 
                  step="0.01" 
                  min="1"
                  placeholder="0.00"
                  value={currentPayment.amount || ''} 
                  onChange={handleInputChange} 
                  required
              />
            </div>
            {isUnderpayment && (
              <Alert variant="destructive" className="flex items-center gap-2 text-xs">
                <AlertTriangle className="h-4 w-4" />
                This is less than the expected monthly payment.
              </Alert>
            )}
            <div>
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input id="paymentDate" name="paymentDate" type="date" value={currentPayment.paymentDate || ''} onChange={handleInputChange} required />
            </div>

            <Separator />
            <div>
              <Label htmlFor="depositModeShare">Deposit Mode</Label>
              <RadioGroup id="depositModeShare" value={currentPayment.depositMode || 'Cash'} onValueChange={handleDepositModeChange} className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="cashShare" /><Label htmlFor="cashShare">Cash</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="bankShare" /><Label htmlFor="bankShare">Bank</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="Wallet" id="walletShare" /><Label htmlFor="walletShare">Wallet</Label></div>
              </RadioGroup>
            </div>

            {(currentPayment.depositMode === 'Bank' || currentPayment.depositMode === 'Wallet') && (
                <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
                        <div>
                            <Label htmlFor="sourceName">Name</Label>
                            <Input id="sourceName" name="sourceName" placeholder={`Enter ${currentPayment.depositMode} Name`} value={currentPayment.sourceName || ''} onChange={handleInputChange} />
                        </div>
                        <div>
                            <Label htmlFor="transactionReference">Ref #</Label>
                            <Input id="transactionReference" name="transactionReference" placeholder="e.g., TRN123XYZ" value={currentPayment.transactionReference || ''} onChange={handleInputChange} />
                        </div>
                    </div>
                    <div className="pl-3">
                         <FileUpload
                            id="evidenceUrl"
                            label="Evidence Attachment"
                            value={currentPayment.evidenceUrl || ''}
                            onValueChange={(newValue) => {
                                setCurrentPayment(prev => ({ ...prev, evidenceUrl: newValue }));
                            }}
                        />
                    </div>
                </div>
            )}

            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting || !currentPayment.commitmentId}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit for Approval
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}
