
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
import { Badge } from '@/components/ui/badge';
import { mockMembers, mockSavings, mockShares, mockDividends } from '@/data/mock';
import type { Member, Saving, Share, Dividend } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Check, X, HandCoins, PieChart, Landmark, FileDown } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { exportToExcel } from '@/lib/utils';

type PendingTransaction = (Saving | Share | Dividend) & { transactionTypeLabel: string };

// Helper function to get data from localStorage or fall back to mock data
const loadFromLocalStorage = <T,>(key: string, mockData: T[]): T[] => {
    if (typeof window === 'undefined') {
        return mockData;
    }
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : mockData;
    } catch (error) {
        console.error(`Error reading ${key} from localStorage`, error);
        return mockData;
    }
};

// Helper function to save data to localStorage
const saveToLocalStorage = (key: string, data: any) => {
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(data));
    }
};


export default function ApproveTransactionsPage() {
  const [allSavings, setAllSavings] = useState<Saving[]>([]);
  const [allShares, setAllShares] = useState<Share[]>([]);
  const [allDividends, setAllDividends] = useState<Dividend[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const { toast } = useToast();

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [transactionToReject, setTransactionToReject] = useState<PendingTransaction | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    // Load initial data from localStorage or mock
    setAllSavings(loadFromLocalStorage('savings', mockSavings));
    setAllShares(loadFromLocalStorage('shares', mockShares));
    setAllDividends(loadFromLocalStorage('dividends', mockDividends));
    setAllMembers(loadFromLocalStorage('members', mockMembers));
  }, []);

  const pendingTransactions = useMemo((): PendingTransaction[] => {
    const pendingSavings: PendingTransaction[] = allSavings
      .filter(s => s.status === 'pending')
      .map(s => ({ ...s, transactionTypeLabel: s.transactionType === 'deposit' ? 'Savings Deposit' : 'Savings Withdrawal' }));

    const pendingShares: PendingTransaction[] = allShares
      .filter(s => s.status === 'pending')
      .map(s => ({ ...s, transactionTypeLabel: 'Share Allocation' }));

    const pendingDividends: PendingTransaction[] = allDividends
      .filter(d => d.status === 'pending')
      .map(d => ({ ...d, transactionTypeLabel: 'Dividend Distribution' }));

    return [...pendingSavings, ...pendingShares, ...pendingDividends].sort(
      (a, b) => new Date(a.date || a.allocationDate).getTime() - new Date(b.date || b.allocationDate).getTime()
    );
  }, [allSavings, allShares, allDividends]);

  const handleApprove = (tx: PendingTransaction) => {
    if (tx.transactionTypeLabel.startsWith('Savings')) {
        const savingTx = tx as Saving;
        const updatedSavings = allSavings.map(s => s.id === tx.id ? { ...s, status: 'approved' } : s);
        setAllSavings(updatedSavings);
        saveToLocalStorage('savings', updatedSavings);
        
        const updatedMembers = allMembers.map(m => {
            if (m.id === tx.memberId) {
                const newBalance = savingTx.transactionType === 'deposit'
                    ? m.savingsBalance + savingTx.amount
                    : m.savingsBalance - savingTx.amount;
                return { ...m, savingsBalance: newBalance < 0 ? 0 : newBalance };
            }
            return m;
        });
        setAllMembers(updatedMembers);
        saveToLocalStorage('members', updatedMembers);

    } else if (tx.transactionTypeLabel === 'Share Allocation') {
        const shareTx = tx as Share;
        const updatedShares = allShares.map(s => s.id === tx.id ? { ...s, status: 'approved' } : s);
        setAllShares(updatedShares);
        saveToLocalStorage('shares', updatedShares);
        
        const updatedMembers = allMembers.map(m => {
            if (m.id === tx.memberId) {
                return { ...m, sharesCount: (m.sharesCount || 0) + shareTx.count };
            }
            return m;
        });
        setAllMembers(updatedMembers);
        saveToLocalStorage('members', updatedMembers);

    } else if (tx.transactionTypeLabel === 'Dividend Distribution') {
        const updatedDividends = allDividends.map(d => d.id === tx.id ? { ...d, status: 'approved' } : d);
        setAllDividends(updatedDividends);
        saveToLocalStorage('dividends', updatedDividends);
    }
    toast({ title: 'Transaction Approved', description: `${tx.transactionTypeLabel} for ${tx.memberName} has been approved.` });
  };
  
  const openRejectModal = (tx: PendingTransaction) => {
    setTransactionToReject(tx);
    setRejectionReason('');
    setIsRejectModalOpen(true);
  };
  
  const handleRejectSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!transactionToReject || !rejectionReason.trim()) {
          toast({ variant: 'destructive', title: 'Error', description: 'Rejection reason cannot be empty.' });
          return;
      }

      const tx = transactionToReject;
      const reason = rejectionReason;
      
      if (tx.transactionTypeLabel.startsWith('Savings')) {
        const updatedSavings = allSavings.map(s => s.id === tx.id ? { ...s, status: 'rejected', notes: reason } : s);
        setAllSavings(updatedSavings);
        saveToLocalStorage('savings', updatedSavings);
      } else if (tx.transactionTypeLabel === 'Share Allocation') {
        const updatedShares = allShares.map(s => s.id === tx.id ? { ...s, status: 'rejected', notes: reason } : s);
        setAllShares(updatedShares);
        saveToLocalStorage('shares', updatedShares);
      } else if (tx.transactionTypeLabel === 'Dividend Distribution') {
        const updatedDividends = allDividends.map(d => d.id === tx.id ? { ...d, status: 'rejected', notes: reason } : d);
        setAllDividends(updatedDividends);
        saveToLocalStorage('dividends', updatedDividends);
      }
      
      toast({ title: 'Transaction Rejected', description: `${tx.transactionTypeLabel} for ${tx.memberName} has been rejected.` });
      setIsRejectModalOpen(false);
      setTransactionToReject(null);
      setRejectionReason('');
  };

  const getTransactionAmountDetails = (tx: PendingTransaction): string => {
    if ('amount' in tx) return `$${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if ('count' in tx) return `${tx.count} shares @ $${tx.valuePerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/share (Value: $${(tx.count * tx.valuePerShare).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
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
      if ('amount' in tx) details = `$${tx.amount.toFixed(2)}`;
      else if ('count' in tx) details = `${tx.count} shares @ $${tx.valuePerShare.toFixed(2)}/share`;

      return {
        'Date': new Date(tx.date || tx.allocationDate).toLocaleDateString(),
        'Member': tx.memberName || allMembers.find(m => m.id === tx.memberId)?.fullName,
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
            {pendingTransactions.length > 0 ? pendingTransactions.map(tx => (
              <TableRow key={tx.id}>
                <TableCell>{new Date(tx.date || tx.allocationDate).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium">{tx.memberName || allMembers.find(m => m.id === tx.memberId)?.fullName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getTransactionTypeIcon(tx.transactionTypeLabel)}
                    <span>{tx.transactionTypeLabel}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{getTransactionAmountDetails(tx)}</TableCell>
                <TableCell className="text-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleApprove(tx)} className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700">
                    <Check className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openRejectModal(tx)} className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700">
                    <X className="mr-1 h-4 w-4" /> Reject
                  </Button>
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
                <Label htmlFor="rejectionReason">Rejection Reason (Required)</Label>
                <Textarea 
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="E.g., Incorrect amount, insufficient funds for withdrawal..."
                    required 
                />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" variant="destructive">Confirm Rejection</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
