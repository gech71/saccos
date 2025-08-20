

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter, Check, ChevronsUpDown, FileDown, Banknote, Shield, MinusCircle, Loader2, AlertTriangle, FileText, UserCheck, CalendarDays, Coins, UserX, UserRound } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import type { Loan, LoanType } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { getLoansPageData, addLoan, updateLoan, deleteLoan, type LoanWithDetails, type LoanInput, type CollateralInput } from './actions';
import { FileUpload } from '@/components/file-upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Link from 'next/link';

type MemberForSelect = { id: string; fullName: string; joinDate: Date; totalSavings: number; totalGuaranteed: number; };

const initialCollateralState: CollateralInput = {
  type: 'GUARANTOR',
};

const initialLoanFormState: Partial<LoanInput & { id?: string }> = {
  memberId: undefined,
  loanTypeId: undefined,
  principalAmount: 0,
  loanTerm: 0,
  disbursementDate: new Date().toISOString().split('T')[0],
  status: 'pending',
  loanAccountNumber: '',
  collaterals: [],
  purpose: '',
  monthlyRepaymentAmount: 0,
  insuranceFee: 0,
  serviceFee: 0,
};

export default function LoansPage() {
  const [loans, setLoans] = useState<LoanWithDetails[]>([]);
  const [members, setMembers] = useState<MemberForSelect[]>([]);
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<string | null>(null);

  const [currentLoan, setCurrentLoan] = useState<Partial<LoanInput & { id?: string, status?: string }>>(initialLoanFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);
  const [monthlyPayment, setMonthlyPayment] = useState<number | null>(null);
  
  const [guarantorToAdd, setGuarantorToAdd] = useState('');
  const [openGuarantorCombobox, setOpenGuarantorCombobox] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedLoanTypeFilter, setSelectedLoanTypeFilter] = useState<string>('all');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openAccordionId, setOpenAccordionId] = useState<string | null>(null);

  const fetchPageData = async () => {
    setIsLoading(true);
    try {
        const data = await getLoansPageData();
        setLoans(data.loans);
        setMembers(data.members);
        setLoanTypes(data.loanTypes);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load page data.' });
    }
    setIsLoading(false);
  }

  useEffect(() => {
    fetchPageData();
  }, []);

  const selectedMember = useMemo(() => members.find(m => m.id === currentLoan.memberId), [members, currentLoan.memberId]);
  const selectedLoanType = useMemo(() => loanTypes.find(lt => lt.id === currentLoan.loanTypeId), [loanTypes, currentLoan.loanTypeId]);
  
  useEffect(() => {
    if (selectedLoanType && currentLoan.principalAmount && currentLoan.principalAmount > 0 && currentLoan.loanTerm && currentLoan.loanTerm > 0) {
        const principal = currentLoan.principalAmount;
        const annualRate = selectedLoanType.interestRate;
        const termInMonths = currentLoan.loanTerm;

        // "Reducing Balance" first month payment calculation
        const principalPortion = principal / termInMonths;
        const interestPortion = principal * (annualRate / 12);
        const firstMonthPayment = principalPortion + interestPortion;
        
        const insuranceFee = (selectedLoanType.insuranceFeePercentage || 0) * principal;
        const serviceFee = selectedLoanType.serviceFee || 0;


        setMonthlyPayment(firstMonthPayment);
        setCurrentLoan(prev => ({
            ...prev, 
            monthlyRepaymentAmount: firstMonthPayment,
            insuranceFee,
            serviceFee
        }));
    } else {
        setMonthlyPayment(null);
        setCurrentLoan(prev => ({...prev, monthlyRepaymentAmount: 0, insuranceFee: 0, serviceFee: 0}));
    }
  }, [currentLoan.principalAmount, currentLoan.loanTerm, selectedLoanType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentLoan(prev => ({ ...prev, [name]: name === 'principalAmount' || name === 'loanTerm' ? parseFloat(value) : value }));
  };

  const handleSelectChange = (name: keyof LoanInput, value: string) => {
    setCurrentLoan(prev => ({ ...prev, [name]: value, purpose: name === 'loanTypeId' ? '' : prev.purpose }));
  };
  
  const handleCollateralChange = (index: number, field: string, value: string) => {
    const updatedCollaterals = [...(currentLoan.collaterals || [])];
    (updatedCollaterals[index] as any)[field] = value;
    setCurrentLoan(prev => ({...prev, collaterals: updatedCollaterals}));
  };
  
  const addTitleDeedCollateral = () => {
    setCurrentLoan(prev => ({
        ...prev,
        collaterals: [...(prev.collaterals || []), { type: 'TITLE_DEED', description: '', documentUrl: '' }]
    }));
  };

  const addGuarantor = () => {
      if (!guarantorToAdd) {
          toast({ variant: 'destructive', title: 'No Guarantor Selected', description: 'Please select a member to add as a guarantor.' });
          return;
      }
      const newGuarantor: CollateralInput = {
          type: 'GUARANTOR',
          guarantorId: guarantorToAdd,
      };
      setCurrentLoan(prev => ({
          ...prev,
          collaterals: [...(prev.collaterals || []), newGuarantor]
      }));
      setGuarantorToAdd(''); // Reset the selector
  };

  const removeCollateral = (index: number) => {
      setCurrentLoan(prev => ({
          ...prev,
          collaterals: (prev.collaterals || []).filter((_, i) => i !== index)
      }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLoan.memberId || !selectedLoanType || !currentLoan.principalAmount || currentLoan.principalAmount <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Member, loan type, and a valid principal amount are required.' });
      return;
    }
    
    setIsSubmitting(true);
    try {
        if (isEditing && currentLoan.id) {
          await updateLoan(currentLoan.id, currentLoan as LoanInput);
          toast({ title: 'Loan Updated', description: 'Loan application has been updated.' });
        } else {
          await addLoan(currentLoan as LoanInput);
          toast({ title: 'Loan Application Submitted', description: 'New loan application submitted for approval.' });
        }
        await fetchPageData();
        setIsModalOpen(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: `${error instanceof Error ? error.message : 'An unexpected error occurred.'}` });
    } finally {
        setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setCurrentLoan(initialLoanFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (loan: LoanWithDetails) => {
    setCurrentLoan({
      ...loan,
      collaterals: loan.guarantors.map(g => ({ type: 'GUARANTOR', guarantorId: g.guarantor.id }))
                    .concat(loan.collaterals.map(c => ({ type: 'TITLE_DEED', documentUrl: c.documentUrl, description: c.description })))
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!loanToDelete) return;
    const result = await deleteLoan(loanToDelete);
    if (result.success) {
        toast({ title: 'Success', description: result.message });
        await fetchPageData();
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setLoanToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const openDeleteDialog = (loanId: string) => {
    setLoanToDelete(loanId);
    setIsDeleteDialogOpen(true);
  };

  const filteredLoans = useMemo(() => {
    return loans.filter(loan => {
      const matchesSearchTerm = loan.memberName ? loan.memberName.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const matchesStatus = selectedStatusFilter === 'all' || loan.status === selectedStatusFilter;
      const matchesLoanType = selectedLoanTypeFilter === 'all' || loan.loanTypeId === selectedLoanTypeFilter;
      return matchesSearchTerm && matchesStatus && matchesLoanType;
    });
  }, [loans, searchTerm, selectedStatusFilter, selectedLoanTypeFilter]);

  const paginatedLoans = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredLoans.slice(startIndex, endIndex);
  }, [filteredLoans, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => Math.ceil(filteredLoans.length / rowsPerPage), [filteredLoans.length, rowsPerPage]);
  
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

  const currentGuarantorIds = useMemo(() =>
    new Set((currentLoan.collaterals || []).filter(c => c.type === 'GUARANTOR').map(c => c.guarantorId))
  , [currentLoan.collaterals]);

  const availableGuarantors = useMemo(() => members.filter(m => 
        m.id !== selectedMember?.id && 
        m.totalGuaranteed < 2 &&
        !currentGuarantorIds.has(m.id)
    ), [members, selectedMember, currentGuarantorIds]);


  return (
    <div className="space-y-6">
      <PageTitle title="Loan Management" subtitle="Manage member loan applications and active loans.">
        <Button onClick={() => openAddModal()}><PlusCircle className="mr-2 h-5 w-5" /> New Loan Application</Button>
      </PageTitle>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input type="search" placeholder="Search by member name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full" />
          </div>
          <Select value={selectedLoanTypeFilter} onValueChange={setSelectedLoanTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Filter by type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Loan Types</SelectItem>
              {loanTypes.map(type => (
                <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : paginatedLoans.length > 0 ? (
        <Accordion type="single" collapsible className="w-full space-y-2">
            {paginatedLoans.map((loan) => {
              let interestNext = 0;
              let principalNext = 0;
              let totalNext = 0;
              
              if ((loan.status === 'active' || loan.status === 'overdue') && loan.loanTerm > 0) {
                  interestNext = loan.remainingBalance * (loan.interestRate / 12);
                  principalNext = loan.principalAmount / loan.loanTerm;
                  
                  const standardPayment = principalNext + interestNext;
                  const finalPayment = loan.remainingBalance + interestNext;
                  
                  totalNext = Math.min(standardPayment, finalPayment);

                  if (totalNext === finalPayment) {
                      principalNext = loan.remainingBalance;
                  }
              }

              return (
                  <AccordionItem value={loan.id} key={loan.id} className="border-b-0">
                      <Card className="shadow-sm">
                          <AccordionTrigger className="p-4 hover:no-underline [&[data-state=open]]:border-b">
                              <div className="flex-1 text-left flex flex-col md:flex-row md:items-center gap-2 md:gap-4 w-full">
                                  <div className="font-medium flex-1 min-w-0 truncate">{loan.memberName}</div>
                                  <div className="text-sm text-muted-foreground flex-1 min-w-0 truncate">{loan.loanTypeName}</div>
                                  <div className="flex-1"><Badge variant={getStatusBadgeVariant(loan.status)}>{loan.status.replace('_', ' ')}</Badge></div>
                                  <div className="font-semibold flex-1 min-w-0 truncate text-right md:text-left">{loan.principalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} Birr</div>
                                  <div className="font-semibold text-primary flex-1 min-w-0 truncate text-right md:text-left">
                                      {totalNext > 0 ? `Est. Pymt: ${totalNext.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ''}
                                  </div>
                              </div>
                          </AccordionTrigger>
                          <AccordionContent className="p-6 pt-4">
                              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                  <div className="space-y-4">
                                    <h4 className="font-semibold">Loan Details</h4>
                                    <div className="text-sm space-y-2">
                                        <p><strong>Principal:</strong> {loan.principalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr</p>
                                        <p><strong>Remaining Balance:</strong> {loan.remainingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr</p>
                                        <p><strong>Disbursed Date:</strong> {new Date(loan.disbursementDate).toLocaleDateString()}</p>
                                        <p><strong>Next Due Date:</strong> {loan.nextDueDate ? new Date(loan.nextDueDate).toLocaleDateString() : 'N/A'}</p>
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <h4 className="font-semibold">Next Payment Details</h4>
                                      <div className="text-sm space-y-2">
                                        <p><strong>Est. Principal:</strong> <span className="text-green-600">{principalNext > 0 ? principalNext.toLocaleString(undefined, { minimumFractionDigits: 2 }) : 'N/A'}</span></p>
                                        <p><strong>Est. Interest:</strong> <span className="text-orange-600">{interestNext > 0 ? interestNext.toLocaleString(undefined, { minimumFractionDigits: 2 }) : 'N/A'}</span></p>
                                        <p><strong>Total Est. Payment:</strong> <span className="font-bold text-primary">{totalNext > 0 ? totalNext.toLocaleString(undefined, { minimumFractionDigits: 2 }) : 'N/A'}</span></p>
                                    </div>
                                  </div>
                                   <div className="space-y-4">
                                      <h4 className="font-semibold">Collateral</h4>
                                      <div className="text-sm space-y-2">
                                          {loan.guarantors.length > 0 && (
                                              <div>
                                                  <strong>Guarantors:</strong>
                                                  <ul className="list-disc pl-5">
                                                      {loan.guarantors.map(g => <li key={g.guarantor.id}>{g.guarantor.fullName}</li>)}
                                                  </ul>
                                              </div>
                                          )}
                                          {loan.collaterals.length > 0 && (
                                              <div>
                                                  <strong>Title Deeds:</strong>
                                                  <ul className="list-disc pl-5">
                                                      {loan.collaterals.map(c => 
                                                        <li key={c.id}>
                                                          {c.documentUrl ? (
                                                            <a href={c.documentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                                                              <FileText className="h-4 w-4" />
                                                              {c.description || 'View Attached Document'}
                                                            </a>
                                                          ) : (
                                                            <span>{c.description || 'Title Deed Attached'}</span>
                                                          )}
                                                        </li>
                                                      )}
                                                  </ul>
                                              </div>
                                          )}
                                          {loan.guarantors.length === 0 && loan.collaterals.length === 0 && <p className="text-muted-foreground">No collateral on record.</p>}
                                      </div>
                                  </div>
                              </div>
                          </AccordionContent>
                      </Card>
                  </AccordionItem>
              );
            })}
        </Accordion>
      ) : (
        <div className="py-12 text-center text-muted-foreground">No loans found matching your criteria.</div>
      )}

      {totalPages > 1 && (
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
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <Button
                            key={page}
                            variant={currentPage === page ? 'default' : 'outline'}
                            size="sm"
                            className="h-9 w-9 p-0"
                            onClick={() => setCurrentPage(page)}
                        >
                            {page}
                        </Button>
                    ))}
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
            <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
            </div>
        </div>
      )}


      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle className="font-headline">{isEditing ? 'Edit' : 'New'} Loan Application</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="loanMemberId">Member</Label>
                    <Popover open={openMemberCombobox} onOpenChange={setOpenMemberCombobox}>
                        <PopoverTrigger asChild>
                        <Button id="loanMemberId" variant="outline" role="combobox" className="w-full justify-between">
                            {selectedMember ? selectedMember.fullName : "Select member..."}
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
                        <SelectContent>{loanTypes.map(lt => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>

            {selectedLoanType?.purposes && selectedLoanType.purposes.length > 0 && (
                <div>
                    <Label htmlFor="purpose">Purpose (for {selectedLoanType.name})</Label>
                    <Select name="purpose" value={currentLoan.purpose || ''} onValueChange={(val) => handleSelectChange('purpose', val)}>
                        <SelectTrigger><SelectValue placeholder="Select holiday purpose..." /></SelectTrigger>
                        <SelectContent>{selectedLoanType.purposes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="principalAmount">Principal Amount</Label>
                <Input id="principalAmount" name="principalAmount" type="number" step="0.01" value={currentLoan.principalAmount || ''} onChange={handleInputChange} placeholder={selectedLoanType ? `${selectedLoanType.minLoanAmount.toLocaleString()} - ${selectedLoanType.maxLoanAmount.toLocaleString()}` : 'Select type first'} required />
              </div>
              <div>
                <Label htmlFor="loanTerm">Repayment Period (Months)</Label>
                <Input id="loanTerm" name="loanTerm" type="number" step="1" value={currentLoan.loanTerm || ''} onChange={handleInputChange} placeholder={selectedLoanType ? `${selectedLoanType.minRepaymentPeriod} - ${selectedLoanType.maxRepaymentPeriod}` : 'Select type first'} required />
              </div>
            </div>

            {selectedMember && selectedLoanType && (
              <Alert variant="default" className="space-y-2">
                <AlertDescription className="text-xs grid grid-cols-2 gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" /><p>Member for {Math.floor((new Date().getTime() - new Date(selectedMember.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} months</p></div>
                    <div className="flex items-center gap-2"><Coins className="h-4 w-4 text-muted-foreground" /><p>Savings: {selectedMember.totalSavings.toLocaleString(undefined, {minimumFractionDigits:2})} ETB</p></div>
                    <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-muted-foreground" /><p>Guaranteed loans: {selectedMember.totalGuaranteed}</p></div>
                </AlertDescription>
                {selectedLoanType.minSavingMonths && selectedMember && (new Date().getTime() - new Date(selectedMember.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 30) < selectedLoanType.minSavingMonths && 
                  <AlertDescription className="text-destructive font-semibold"><AlertTriangle className="inline h-4 w-4 mr-1"/>Not eligible: Member for less than {selectedLoanType.minSavingMonths} months.</AlertDescription>}
              </Alert>
            )}

            <div className="p-3 border rounded-md bg-muted text-sm space-y-1">
                <div className="flex justify-between"><span>Interest Rate:</span><span className="font-semibold">{(selectedLoanType?.interestRate || 0) * 100}%</span></div>
                {selectedLoanType && (
                  <>
                    <div className="flex justify-between"><span>Service Fee:</span><span className="font-semibold">{(currentLoan.serviceFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} ETB</span></div>
                    <div className="flex justify-between"><span>Insurance Fee ({((selectedLoanType?.insuranceFeePercentage || 0) * 100).toFixed(2)}%):</span><span className="font-semibold">{(currentLoan.insuranceFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} ETB</span></div>
                  </>
                )}
                 <div className="flex justify-between font-semibold"><span>Net Amount to be Disbursed:</span><span className="font-bold text-green-600">{((currentLoan.principalAmount || 0) - (currentLoan.serviceFee || 0) - (currentLoan.insuranceFee || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})} ETB</span></div>
                {monthlyPayment && <div className="flex justify-between text-primary font-bold pt-2 border-t mt-2"><span className='text-sm text-muted-foreground'>Est. First Month Repayment:</span><span>{monthlyPayment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>}
            </div>

            <Separator/>
            <Label className="font-semibold text-base text-primary">Collateral</Label>
            
            {selectedLoanType?.collateralLogic === 'GUARANTOR_AND_TITLE_DEED_OVER_200K' && currentLoan.principalAmount && currentLoan.principalAmount > 200000 && 
                <Alert><AlertTriangle className="h-4 w-4"/><AlertDescription>A house title deed is required for loans over 200,000 ETB.</AlertDescription></Alert>}

            {/* Guarantor Section */}
            <div className="space-y-2 p-3 border rounded-md">
                <Label>Member Guarantors</Label>
                <div className="flex items-end gap-2">
                    <div className="flex-grow">
                        <Popover open={openGuarantorCombobox} onOpenChange={setOpenGuarantorCombobox}>
                            <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
                            >
                                {guarantorToAdd ? availableGuarantors.find(g => g.id === guarantorToAdd)?.fullName : "Select a guarantor..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search member..." />
                                    <CommandList>
                                        <CommandEmpty>No available members found.</CommandEmpty>
                                        <CommandGroup>
                                            {availableGuarantors.map(m => (
                                                <CommandItem
                                                    key={m.id}
                                                    value={`${m.fullName} ${m.id}`}
                                                    onSelect={() => {
                                                        setGuarantorToAdd(m.id)
                                                        setOpenGuarantorCombobox(false)
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", guarantorToAdd === m.id ? "opacity-100" : "opacity-0")} />
                                                    {m.fullName} (Guaranteed: {m.totalGuaranteed})
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <Button type="button" onClick={addGuarantor} disabled={!guarantorToAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Guarantor
                    </Button>
                </div>
                {(currentLoan.collaterals || []).filter(c => c.type === 'GUARANTOR').length > 0 && (
                    <div className="space-y-2 pt-2">
                        {(currentLoan.collaterals || []).filter(c => c.type === 'GUARANTOR').map((g, index) => {
                            const guarantorMember = members.find(m => m.id === g.guarantorId);
                            return (
                                <div key={`guarantor-${index}`} className="flex justify-between items-center p-2 bg-muted/50 rounded-md text-sm">
                                    <span className="font-medium">{guarantorMember?.fullName || g.guarantorId}</span>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeCollateral((currentLoan.collaterals || []).findIndex(c => c.guarantorId === g.guarantorId))}>
                                        <UserX className="h-4 w-4"/>
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
            
            {/* Title Deed Section */}
             <div className="space-y-2 p-3 border rounded-md">
                <Label>Title Deeds</Label>
                {(currentLoan.collaterals || []).filter(c => c.type === 'TITLE_DEED').map((collateral, index) => {
                    // Find the original index in the main collaterals array
                    const originalIndex = (currentLoan.collaterals || []).findIndex(c => c === collateral);
                    return (
                        <div key={`title-deed-${index}`} className="space-y-3 p-3 border rounded-md relative bg-muted/50">
                             <Button type="button" variant="ghost" size="icon" onClick={() => removeCollateral(originalIndex)} className="absolute top-1 right-1 text-destructive hover:bg-destructive/10 h-7 w-7"><MinusCircle className="h-5 w-5" /></Button>
                             <FileUpload id={`title-deed-url-${index}`} label="Upload Title Deed" value={collateral.documentUrl || ''} onValueChange={(val) => handleCollateralChange(originalIndex, 'documentUrl', val)} />
                             <Input placeholder="Brief description of the property" value={collateral.description || ''} onChange={(e) => handleCollateralChange(originalIndex, 'description', e.target.value)} />
                        </div>
                    )
                })}
                 <Button type="button" variant="outline" size="sm" onClick={addTitleDeedCollateral}><PlusCircle className="mr-2 h-4 w-4" /> Add Title Deed</Button>
             </div>


            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Submit Application'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the loan application.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Yes, delete application</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
