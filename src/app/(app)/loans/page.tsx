
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter, Check, ChevronsUpDown, FileDown, Banknote } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { mockLoans, mockMembers, mockLoanTypes } from '@/data/mock';
import type { Loan, Member, LoanType } from '@/types';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { exportToExcel } from '@/lib/utils';

const initialLoanFormState: Partial<Loan> = {
  memberId: '',
  loanTypeId: '',
  principalAmount: 0,
  disbursementDate: new Date().toISOString().split('T')[0],
  status: 'pending',
};

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>(mockLoans);
  const [members] = useState<Member[]>(mockMembers);
  const [loanTypes] = useState<LoanType[]>(mockLoanTypes);
  const { toast } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentLoan, setCurrentLoan] = useState<Partial<Loan>>(initialLoanFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  
  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null);
  const [loggedInMemberId, setLoggedInMemberId] = useState<string | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('userRole') as 'admin' | 'member' | null;
    const memberId = localStorage.getItem('loggedInMemberId');
    setUserRole(role);
    setLoggedInMemberId(memberId);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentLoan(prev => ({ ...prev, [name]: name === 'principalAmount' ? parseFloat(value) : value }));
  };

  const handleSelectChange = (name: keyof Loan, value: string) => {
    setCurrentLoan(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLoan.memberId || !currentLoan.loanTypeId || !currentLoan.principalAmount || currentLoan.principalAmount <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Member, loan type, and a valid principal amount are required.' });
      return;
    }
    
    const selectedLoanType = loanTypes.find(lt => lt.id === currentLoan.loanTypeId);
    if (!selectedLoanType) {
        toast({ variant: 'destructive', title: 'Error', description: 'Invalid loan type selected.' });
        return;
    }

    const memberActiveLoans = loans.filter(l => l.memberId === currentLoan.memberId && l.status === 'active');
    if (!selectedLoanType.allowConcurrent && memberActiveLoans.length > 0 && !(isEditing && currentLoan.id && memberActiveLoans.some(l => l.id === currentLoan.id))) {
        toast({ variant: 'destructive', title: 'Loan Policy Violation', description: `This member has an active loan, and the selected loan type (${selectedLoanType.name}) does not allow concurrent loans.` });
        return;
    }

    const memberName = members.find(m => m.id === currentLoan.memberId)?.fullName;

    if (isEditing && currentLoan.id) {
      const updatedLoan = { ...currentLoan, memberName, loanTypeName: selectedLoanType.name, status: 'pending' } as Loan;
      setLoans(prev => prev.map(l => l.id === currentLoan.id ? updatedLoan : l));
      toast({ title: 'Loan Updated', description: `Loan application for ${memberName} updated.` });
    } else {
      const newLoan: Loan = {
        ...initialLoanFormState,
        ...currentLoan,
        id: `loan-${Date.now()}`,
        memberName,
        loanTypeName: selectedLoanType.name,
        interestRate: selectedLoanType.interestRate,
        loanTerm: selectedLoanType.loanTerm,
        repaymentFrequency: selectedLoanType.repaymentFrequency,
        remainingBalance: currentLoan.principalAmount!,
      } as Loan;
      setLoans(prev => [newLoan, ...prev]);
      toast({ title: 'Loan Application Submitted', description: `New loan application for ${memberName} submitted for approval.` });
    }
    setIsModalOpen(false);
    setCurrentLoan(initialLoanFormState);
    setIsEditing(false);
  };

  const openAddModal = () => {
    setCurrentLoan(initialLoanFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (loan: Loan) => {
    setCurrentLoan({
      ...loan,
      disbursementDate: loan.disbursementDate ? new Date(loan.disbursementDate).toISOString().split('T')[0] : '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = (loanId: string) => {
    if (window.confirm('Are you sure you want to delete this loan application? This cannot be undone.')) {
      setLoans(prev => prev.filter(l => l.id !== loanId));
      toast({ title: 'Success', description: 'Loan application deleted.' });
    }
  };

  const filteredLoans = useMemo(() => {
    return loans.filter(loan => {
      if (userRole === 'member' && loan.memberId !== loggedInMemberId) {
        return false;
      }
      const member = members.find(m => m.id === loan.memberId);
      const matchesSearchTerm = userRole === 'admin' ? (member ? member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) : false) : true;
      const matchesStatus = selectedStatusFilter === 'all' || loan.status === selectedStatusFilter;
      return matchesSearchTerm && matchesStatus;
    });
  }, [loans, members, searchTerm, selectedStatusFilter, userRole, loggedInMemberId]);
  
  const getStatusBadgeVariant = (status: Loan['status']) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'active': return 'default';
      case 'overdue': return 'destructive';
      case 'paid_off': return 'outline';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const handleExport = () => {
    const dataToExport = filteredLoans.map(loan => ({
        'Member Name': loan.memberName || 'N/A',
        'Loan Type': loan.loanTypeName || 'N/A',
        'Status': loan.status,
        'Principal Amount ($)': loan.principalAmount,
        'Remaining Balance ($)': loan.remainingBalance,
        'Interest Rate (%)': (loan.interestRate * 100).toFixed(2),
        'Disbursement Date': new Date(loan.disbursementDate).toLocaleDateString(),
        'Next Due Date': loan.nextDueDate ? new Date(loan.nextDueDate).toLocaleDateString() : 'N/A',
    }));
    exportToExcel(dataToExport, 'loans_export');
  };

  return (
    <div className="space-y-6">
      <PageTitle title={userRole === 'member' ? 'My Loans' : "Loan Management"} subtitle={userRole === 'member' ? 'View your loan history and status.' : "Manage member loan applications and active loans."}>
        {userRole === 'admin' && (
            <>
                <Button onClick={handleExport} variant="outline"><FileDown className="mr-2 h-4 w-4" /> Export</Button>
                <Button onClick={openAddModal}><PlusCircle className="mr-2 h-5 w-5" /> New Loan Application</Button>
            </>
        )}
      </PageTitle>

      {userRole === 'admin' && (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input type="search" placeholder="Search by member name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full" />
            </div>
            <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="paid_off">Paid Off</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              {userRole === 'admin' && <TableHead>Member</TableHead>}
              <TableHead>Loan Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Principal ($)</TableHead>
              <TableHead className="text-right">Balance ($)</TableHead>
              <TableHead>Disbursed</TableHead>
              <TableHead>Next Due</TableHead>
              {userRole === 'admin' && <TableHead className="text-right w-[120px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLoans.length > 0 ? filteredLoans.map(loan => (
              <TableRow key={loan.id}>
                {userRole === 'admin' && <TableCell className="font-medium">{loan.memberName}</TableCell>}
                <TableCell>{loan.loanTypeName}</TableCell>
                <TableCell><Badge variant={getStatusBadgeVariant(loan.status)}>{loan.status.replace('_', ' ')}</Badge></TableCell>
                <TableCell className="text-right">${loan.principalAmount.toFixed(2)}</TableCell>
                <TableCell className="text-right font-semibold">${loan.remainingBalance.toFixed(2)}</TableCell>
                <TableCell>{new Date(loan.disbursementDate).toLocaleDateString()}</TableCell>
                <TableCell>{loan.nextDueDate ? new Date(loan.nextDueDate).toLocaleDateString() : 'N/A'}</TableCell>
                {userRole === 'admin' && <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><span className="sr-only">Menu</span><Banknote className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(loan)} disabled={loan.status === 'active' || loan.status === 'paid_off'}><Edit className="mr-2 h-4 w-4" /> Edit Application</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(loan.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete Application</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>}
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={userRole === 'admin' ? 8 : 7} className="h-24 text-center">No loans found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Loan Application' : 'New Loan Application'}</DialogTitle>
            <DialogDescription>{isEditing ? 'Update the details for this loan application.' : 'Submit a new loan application for a member for approval.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="loanMemberId">Member</Label>
              <Popover open={openMemberCombobox} onOpenChange={setOpenMemberCombobox}>
                <PopoverTrigger asChild>
                  <Button id="loanMemberId" variant="outline" role="combobox" className="w-full justify-between">
                    {currentLoan.memberId ? members.find(m => m.id === currentLoan.memberId)?.fullName : "Select member..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search member..." />
                    <CommandList><CommandEmpty>No member found.</CommandEmpty><CommandGroup>
                        {members.map(member => (
                          <CommandItem key={member.id} value={member.fullName} onSelect={() => { handleSelectChange('memberId', member.id); setOpenMemberCombobox(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", currentLoan.memberId === member.id ? "opacity-100" : "opacity-0")} />
                            {member.fullName}
                          </CommandItem>
                        ))}
                    </CommandGroup></CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="loanTypeId">Loan Type</Label>
              <Select name="loanTypeId" value={currentLoan.loanTypeId} onValueChange={(val) => handleSelectChange('loanTypeId', val)} required>
                <SelectTrigger><SelectValue placeholder="Select a loan type" /></SelectTrigger>
                <SelectContent>{loanTypes.map(lt => <SelectItem key={lt.id} value={lt.id}>{lt.name} ({lt.interestRate*100}% Interest, {lt.loanTerm} mos)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="principalAmount">Principal Amount ($)</Label>
                <Input id="principalAmount" name="principalAmount" type="number" step="0.01" value={currentLoan.principalAmount || ''} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="disbursementDate">Disbursement Date</Label>
                <Input id="disbursementDate" name="disbursementDate" type="date" value={currentLoan.disbursementDate} onChange={handleInputChange} required />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea id="notes" name="notes" value={currentLoan.notes || ''} onChange={handleInputChange} placeholder="E.g., Purpose of the loan, special conditions." />
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Submit Application'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
