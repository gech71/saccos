
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Check, X, HandCoins, PieChart, Landmark, FileDown, Loader2, Banknote, Filter } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { exportToExcel } from '@/lib/utils';
import { 
    getPendingTransactions, 
    approveTransaction, 
    rejectTransaction, 
    approveMultipleTransactions,
    rejectMultipleTransactions,
    type PendingTransaction 
} from './actions';
import type { Saving, SharePayment, Dividend, Loan } from '@prisma/client';
import { useAuth } from '@/contexts/auth-context';

type TransactionCategory = 'All' | 'Savings' | 'Shares' | 'Dividends' | 'Loans';

export default function ApproveTransactionsPage() {
  const [allTransactions, setAllTransactions] = useState<PendingTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<TransactionCategory>('All');

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [transactionToActOn, setTransactionToActOn] = useState<PendingTransaction | null>(null);
  const [isBulkAction, setIsBulkAction] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const canApprove = useMemo(() => user?.permissions.includes('transactionApproval:edit'), [user]);

  const fetchPendingTransactions = async () => {
    setIsLoading(true);
    try {
        const data = await getPendingTransactions();
        setAllTransactions(data);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load pending transactions.'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPendingTransactions();
    }
  }, [user, toast]);

  const filteredTransactions = useMemo(() => {
    if (filter === 'All') return allTransactions;
    return allTransactions.filter(tx => tx.transactionCategory === filter);
  }, [allTransactions, filter]);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, currentPage, rowsPerPage]);
  
  const isAllSelected = useMemo(() => paginatedTransactions.length > 0 && selectedIds.size === paginatedTransactions.length, [selectedIds, paginatedTransactions]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredTransactions.length / rowsPerPage);
  }, [filteredTransactions.length, rowsPerPage]);

  const getPaginationItems = () => {
    if (totalPages <= 1) return [];
    const delta = 1;
    const left = currentPage - delta;
    const right = currentPage + delta + 1;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= left && i < right)) {
            range.push(i);
        }
    }

    let l: number | undefined;
    for (const i of range) {
        if (l) {
            if (i - l === 2) {
                rangeWithDots.push(l + 1);
            } else if (i - l !== 1) {
                rangeWithDots.push('...');
            }
        }
        rangeWithDots.push(i);
        l = i;
    }

    return rangeWithDots;
  };
  
  const paginationItems = getPaginationItems();
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedTransactions.map(tx => tx.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (txId: string, checked: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(txId);
      } else {
        newSet.delete(txId);
      }
      return newSet;
    });
  };

  const handleApprove = async (tx: PendingTransaction) => {
    setIsSubmitting(true);
    const result = await approveTransaction(tx.id, tx.transactionTypeLabel);
    if (result.success) {
      toast({ title: 'Transaction Approved', description: result.message });
      await fetchPendingTransactions();
      setSelectedIds(new Set());
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsSubmitting(false);
  };
  
  const openRejectModal = (tx?: PendingTransaction) => {
    if (tx) {
        setTransactionToActOn(tx);
        setIsBulkAction(false);
    } else {
        setIsBulkAction(true);
    }
    setRejectionReason('');
    setIsRejectModalOpen(true);
  };
  
  const handleRejectSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!rejectionReason.trim()) {
          toast({ variant: 'destructive', title: 'Error', description: 'Rejection reason cannot be empty.' });
          return;
      }
      
      setIsSubmitting(true);

      let result;
      if (isBulkAction) {
          const transactionsToReject = allTransactions.filter(tx => selectedIds.has(tx.id));
          result = await rejectMultipleTransactions(transactionsToReject.map(tx => ({ txId: tx.id, txType: tx.transactionTypeLabel})), rejectionReason);
      } else if (transactionToActOn) {
          result = await rejectTransaction(transactionToActOn.id, transactionToActOn.transactionTypeLabel, rejectionReason);
      }

      if (result?.success) {
        toast({ title: 'Transaction(s) Rejected', description: result.message });
        await fetchPendingTransactions();
        setSelectedIds(new Set());
        setIsRejectModalOpen(false);
        setTransactionToActOn(null);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result?.message });
      }
      setIsSubmitting(false);
  };
  
  const handleBulkApprove = async () => {
      setIsSubmitting(true);
      const transactionsToApprove = allTransactions.filter(tx => selectedIds.has(tx.id));
      const result = await approveMultipleTransactions(transactionsToApprove.map(tx => ({ txId: tx.id, txType: tx.transactionTypeLabel })));
      
       if (result.success) {
        toast({ title: 'Transactions Approved', description: result.message });
        await fetchPendingTransactions();
        setSelectedIds(new Set());
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
      setIsSubmitting(false);
  };


  const getTransactionAmountDetails = (tx: PendingTransaction): string => {
    if (tx.transactionCategory === 'Savings' || tx.transactionCategory === 'Dividends' || tx.transactionCategory === 'Shares') {
        const anyTx = tx as Saving | SharePayment | Dividend;
        return `${anyTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr`;
    }
    if (tx.transactionCategory === 'Loans') {
        const loanTx = tx as Loan;
        return `${loanTx.principalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr Loan`;
    }
    return 'N/A';
  };
  
  const getTransactionTypeIcon = (txLabel: string) => {
      if (txLabel.startsWith('Savings')) return <HandCoins className="h-5 w-5 text-green-600" />;
      if (txLabel.startsWith('Share Payment')) return <PieChart className="h-5 w-5 text-blue-600" />;
      if (txLabel === 'Dividend Distribution') return <Landmark className="h-5 w-5 text-purple-600" />;
      if (txLabel === 'Loan Application') return <Banknote className="h-5 w-5 text-indigo-600" />;
      return null;
  };

  const handleExport = () => {
    const dataToExport = filteredTransactions.map(tx => {
      let details = '';
      if ('amount' in tx) details = `${(tx as Saving | SharePayment | Dividend).amount.toFixed(2)} Birr`;
      else if ('principalAmount' in tx) {
          details = `Loan of ${(tx as Loan).principalAmount.toFixed(2)} Birr`;
      }
      return {
        'Date': new Date((tx as any).date || (tx as any).paymentDate || (tx as any).disbursementDate || (tx as any).distributionDate).toLocaleDateString(),
        'Member': tx.memberName,
        'Transaction Type': tx.transactionTypeLabel,
        'Amount / Details': details,
        'Notes': tx.notes || '',
      };
    });
    exportToExcel(dataToExport, 'pending_transactions_export');
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Approve Transactions" subtitle={`Review and approve or reject pending financial transactions. ${allTransactions.length} transaction(s) awaiting approval.`}>
        <Button onClick={handleExport} variant="outline" disabled={allTransactions.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Export
        </Button>
      </PageTitle>

      <div className="flex flex-col sm:flex-row items-center gap-4">
          <Select value={filter} onValueChange={(value) => { setFilter(value as TransactionCategory); setSelectedIds(new Set()); }}>
              <SelectTrigger className="w-full sm:w-[220px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="All">All Transactions</SelectItem>
                  <SelectItem value="Savings">Savings</SelectItem>
                  <SelectItem value="Shares">Shares</SelectItem>
                  <SelectItem value="Dividends">Dividends</SelectItem>
                  <SelectItem value="Loans">Loan Applications</SelectItem>
              </SelectContent>
          </Select>
          {selectedIds.size > 0 && canApprove && (
              <div className="flex items-center gap-2 animate-in fade-in-50 duration-300">
                  <Button size="sm" onClick={handleBulkApprove} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4"/> }
                    Approve ({selectedIds.size})
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => openRejectModal()} disabled={isSubmitting}>
                    <X className="mr-2 h-4 w-4"/>
                    Reject ({selectedIds.size})
                  </Button>
              </div>
          )}
      </div>
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    aria-label="Select all"
                    disabled={!canApprove}
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Transaction Type</TableHead>
              <TableHead className="text-right">Amount / Details</TableHead>
              <TableHead className="text-center w-[200px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                 <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : paginatedTransactions.length > 0 ? paginatedTransactions.map(tx => (
              <TableRow key={tx.id} data-state={selectedIds.has(tx.id) && 'selected'}>
                <TableCell>
                    <Checkbox
                        checked={selectedIds.has(tx.id)}
                        onCheckedChange={(checked) => handleSelectRow(tx.id, !!checked)}
                        aria-label={`Select transaction ${tx.id}`}
                        disabled={!canApprove}
                    />
                </TableCell>
                <TableCell>{new Date((tx as any).date || (tx as any).paymentDate || (tx as any).disbursementDate || (tx as any).distributionDate).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium">{tx.memberName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getTransactionTypeIcon(tx.transactionTypeLabel)}
                    <span>{tx.transactionTypeLabel}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{getTransactionAmountDetails(tx)}</TableCell>
                <TableCell className="text-center">
                  {canApprove ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleApprove(tx)} className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700" disabled={isSubmitting}>
                        <Check className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openRejectModal(tx)} className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700" disabled={isSubmitting}>
                        <X className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No permissions</span>
                  )}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No pending transactions matching the filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {filteredTransactions.length > 0 && (
        <div className="flex flex-col items-center gap-4 pt-4">
            <div className="flex items-center space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    Previous
                </Button>
                <div className="flex items-center gap-1">
                    {paginationItems.map((item, index) =>
                        typeof item === 'number' ? (
                            <Button
                                key={index}
                                variant={currentPage === item ? 'default' : 'outline'}
                                size="sm"
                                className="h-9 w-9 p-0"
                                onClick={() => setCurrentPage(item)}
                            >
                                {item}
                            </Button>
                        ) : (
                            <span key={index} className="px-2">
                                {item}
                            </span>
                        )
                    )}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                >
                    Next
                </Button>
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8 text-sm text-muted-foreground">
                <div>Page {currentPage} of {totalPages || 1}</div>
                <div>{filteredTransactions.length} transaction(s) found.</div>
                <div className="flex items-center space-x-2">
                    <p className="font-medium">Rows:</p>
                    <Select
                        value={`${rowsPerPage}`}
                        onValueChange={(value) => {
                            setRowsPerPage(Number(value));
                            setCurrentPage(1);
                        }}
                    >
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={`${rowsPerPage}`} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[10, 15, 20, 25, 50].map((pageSize) => (
                                <SelectItem key={pageSize} value={`${pageSize}`}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
      )}

       <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Transaction(s)</DialogTitle>
            <DialogDescription>
                {isBulkAction
                    ? `Please provide a reason for rejecting the ${selectedIds.size} selected transaction(s).`
                    : `Please provide a reason for rejecting this transaction for ${transactionToActOn?.memberName}.`
                }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRejectSubmit} className="space-y-4 py-4">
             <div>
                <Label htmlFor="rejectionReason">Rejection Reason <span className="text-destructive">*</span></Label>
                <Textarea 
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="E.g., Incorrect amount, insufficient funds for withdrawal..."
                    required
                    disabled={isSubmitting}
                />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" variant="destructive" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Rejection
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
