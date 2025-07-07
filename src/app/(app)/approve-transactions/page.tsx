
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
import { Check, X, HandCoins, PieChart, Landmark, FileDown, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { exportToExcel } from '@/lib/utils';
import { getPendingTransactions, approveTransaction, rejectTransaction, type PendingTransaction } from './actions';
import type { Saving, Share, Dividend } from '@prisma/client';
import { useAuth } from '@/contexts/auth-context';

export default function ApproveTransactionsPage() {
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [transactionToReject, setTransactionToReject] = useState<PendingTransaction | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canApprove = useMemo(() => user?.permissions.includes('transactionApproval:edit'), [user]);
  
  const fetchPendingTransactions = async () => {
    setIsLoading(true);
    try {
        const data = await getPendingTransactions();
        setPendingTransactions(data);
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

  const handleApprove = async (tx: PendingTransaction) => {
    const result = await approveTransaction(tx.id, tx.transactionTypeLabel);
    if (result.success) {
      toast({ title: 'Transaction Approved', description: result.message });
      await fetchPendingTransactions();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
  };
  
  const openRejectModal = (tx: PendingTransaction) => {
    setTransactionToReject(tx);
    setRejectionReason('');
    setIsRejectModalOpen(true);
  };
  
  const handleRejectSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!transactionToReject || !rejectionReason.trim()) {
          toast({ variant: 'destructive', title: 'Error', description: 'Rejection reason cannot be empty.' });
          return;
      }

      setIsSubmitting(true);
      const result = await rejectTransaction(transactionToReject.id, transactionToReject.transactionTypeLabel, rejectionReason);

      if (result.success) {
        toast({ title: 'Transaction Rejected', description: result.message });
        await fetchPendingTransactions();
        setIsRejectModalOpen(false);
        setTransactionToReject(null);
        setRejectionReason('');
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
      setIsSubmitting(false);
  };

  const getTransactionAmountDetails = (tx: PendingTransaction): string => {
    if ('amount' in tx) return `ETB ${(tx as Saving | Dividend).amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if ('count' in tx) {
        const shareTx = tx as Share;
        return `${shareTx.count} shares @ ETB ${shareTx.valuePerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/share (Value: ETB ${(shareTx.totalValueForAllocation || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    return 'N/A';
  };
  
  const getTransactionTypeIcon = (txLabel: string) => {
      if (txLabel.startsWith('Savings')) return <HandCoins className="h-5 w-5 text-green-600" />;
      if (txLabel === 'Share Allocation') return <PieChart className="h-5 w-5 text-blue-600" />;
      if (txLabel === 'Dividend Distribution') return <Landmark className="h-5 w-5 text-purple-600" />;
      return null;
  };

  const handleExport = () => {
    const dataToExport = pendingTransactions.map(tx => {
      let details = '';
      if ('amount' in tx) details = `ETB ${(tx as Saving | Dividend).amount.toFixed(2)}`;
      else if ('count' in tx) {
          const shareTx = tx as Share;
          details = `${shareTx.count} shares @ ETB ${shareTx.valuePerShare.toFixed(2)}/share`;
      }
      return {
        'Date': new Date(tx.date || tx.allocationDate).toLocaleDateString(),
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
      <PageTitle title="Approve Transactions" subtitle={`Review and approve or reject pending financial transactions. ${pendingTransactions.length} transaction(s) awaiting approval.`}>
        <Button onClick={handleExport} variant="outline" disabled={pendingTransactions.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Export
        </Button>
      </PageTitle>
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Transaction Type</TableHead>
              <TableHead className="text-right">Amount / Details</TableHead>
              <TableHead className="text-center w-[200px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                 <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : pendingTransactions.length > 0 ? pendingTransactions.map(tx => (
              <TableRow key={tx.id}>
                <TableCell>{new Date(tx.date || tx.allocationDate).toLocaleDateString()}</TableCell>
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
                      <Button variant="outline" size="sm" onClick={() => handleApprove(tx)} className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700">
                        <Check className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openRejectModal(tx)} className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700">
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
                <TableCell colSpan={5} className="h-24 text-center">
                  No pending transactions to approve.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

       <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Transaction</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this transaction for {transactionToReject?.memberName}.
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
