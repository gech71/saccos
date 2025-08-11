

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter, Check, ChevronsUpDown, FileDown, Banknote, Shield, MinusCircle, Loader2, AlertTriangle, FileText, UserCheck, CalendarDays, Coins } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { exportToExcel } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { getLoansPageData, addLoan, updateLoan, deleteLoan, type LoanWithDetails, type LoanInput, type CollateralInput } from './actions';
import { FileUpload } from '@/components/file-upload';
import { Alert, AlertDescription } from '@/components/ui/alert';

const specialLoanPurposes = ["Enkutatash", "Gena", "Fasika", "Eid Mubarak", "Mawlid", "Eid al-Adha (Arefa)"];

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

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedLoanTypeFilter, setSelectedLoanTypeFilter] = useState<string>('all');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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
  const eligibleGuarantors = useMemo(() => members.filter(m => m.id !== selectedMember?.id && m.totalGuaranteed < 2), [members, selectedMember]);


  useEffect(() => {
    if (selectedLoanType && currentLoan.principalAmount && currentLoan.principalAmount > 0 && currentLoan.loanTerm && currentLoan.loanTerm > 0) {
        const principal = currentLoan.principalAmount;
        const annualRate = selectedLoanType.interestRate;
        const termInMonths = currentLoan.loanTerm;

        // "Reducing Balance" first month payment calculation
        const principalPortion = principal / termInMonths;
        const interestPortion = principal * (annualRate / 12);
        const firstMonthPayment = principalPortion + interestPortion;
        
        const insuranceFee = selectedLoanType.name === 'Regular Loan' ? principal * 0.01 : 0;
        const serviceFee = selectedLoanType.name === 'Regular Loan' ? 15 : 0;

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

  const addCollateral = () => {
    setCurrentLoan(prev => ({
        ...prev,
        collaterals: [...(prev.collaterals || []), initialCollateralState]
    }));
  };

  const removeCollateral = (index: number) => {
      setCurrentLoan(prev => ({
          ...prev,
          collaterals: (prev.collaterals || []).filter((_, i) => i !== index)
      }));
  };

  const handleCollateralChange = (index: number, field: string, value: string) => {
    const updatedCollaterals = [...(currentLoan.collaterals || [])];
    (updatedCollaterals[index] as any)[field] = value;
    setCurrentLoan(prev => ({...prev, collaterals: updatedCollaterals}));
  };
  
  const handleCollateralTypeChange = (index: number, type: 'GUARANTOR' | 'TITLE_DEED') => {
      const updatedCollaterals = [...(currentLoan.collaterals || [])];
      updatedCollaterals[index] = { type }; // Reset the collateral object
      setCurrentLoan(prev => ({...prev, collaterals: updatedCollaterals}));
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

      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Loan Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Principal</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Next Interest</TableHead>
              <TableHead className="text-right">Next Principal</TableHead>
              <TableHead className="text-right">Next Payment</TableHead>
              <TableHead>Disbursed</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={10} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            ) : paginatedLoans.length > 0 ? paginatedLoans.map(loan => {
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
              <TableRow key={loan.id}>
                <TableCell className="font-medium">{loan.memberName}</TableCell>
                <TableCell>{loan.loanTypeName}</TableCell>
                <TableCell><Badge variant={getStatusBadgeVariant(loan.status)}>{loan.status.replace('_', ' ')}</Badge></TableCell>
                <TableCell className="text-right">{loan.principalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right font-semibold">{loan.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right text-orange-600">{interestNext > 0 ? interestNext.toLocaleString(undefined, { minimumFractionDigits: 2 }) : 'N/A'}</TableCell>
                <TableCell className="text-right text-green-600">{principalNext > 0 ? principalNext.toLocaleString(undefined, { minimumFractionDigits: 2 }) : 'N/A'}</TableCell>
                <TableCell className="text-right font-bold text-primary">{totalNext > 0 ? totalNext.toLocaleString(undefined, { minimumFractionDigits: 2 }) : 'N/A'}</TableCell>
                <TableCell>{new Date(loan.disbursementDate).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                    {loan.status !== 'paid_off' && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Banknote className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(loan)} disabled={loan.status === 'active' || loan.status === 'paid_off'}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteDialog(loan.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </TableCell>
              </TableRow>
              )
            }) : (
              <TableRow><TableCell colSpan={10} className="h-24 text-center">No loans found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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

            {selectedLoanType?.name === 'Special Loan' && (
                <div>
                    <Label htmlFor="purpose">Purpose (for Special Loan)</Label>
                    <Select name="purpose" value={currentLoan.purpose} onValueChange={(val) => handleSelectChange('purpose', val)}>
                        <SelectTrigger><SelectValue placeholder="Select holiday purpose..." /></SelectTrigger>
                        <SelectContent>{specialLoanPurposes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
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
                {selectedLoanType.name === 'Special Loan' && (!selectedMember || (new Date().getTime() - new Date(selectedMember.joinDate).getTime()) / (1000*60*60*24*30) < 3) && <AlertDescription className="text-destructive font-semibold"><AlertTriangle className="inline h-4 w-4 mr-1"/>Not eligible: Member for less than 3 months.</AlertDescription>}
              </Alert>
            )}

            <div className="p-3 border rounded-md bg-muted text-sm space-y-1">
                <div className="flex justify-between"><span>Interest Rate:</span><span className="font-semibold">{(selectedLoanType?.interestRate || 0) * 100}%</span></div>
                {selectedLoanType?.name === 'Regular Loan' && (
                  <>
                    <div className="flex justify-between"><span>Service Fee:</span><span className="font-semibold">{(currentLoan.serviceFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} ETB</span></div>
                    <div className="flex justify-between"><span>Insurance Fee (1%):</span><span className="font-semibold">{(currentLoan.insuranceFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} ETB</span></div>
                  </>
                )}
                {monthlyPayment && <div className="flex justify-between text-primary font-bold pt-2 border-t mt-2"><span className='text-sm text-muted-foreground'>Est. First Month Repayment:</span><span>{monthlyPayment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>}
            </div>

            <Separator/>
            <Label className="font-semibold text-base text-primary">Collateral</Label>
            
            {selectedLoanType?.name === 'Regular Loan' && currentLoan.principalAmount && currentLoan.principalAmount > 200000 && 
                <Alert><AlertTriangle className="h-4 w-4"/><AlertDescription>A house title deed is required for loans over 200,000 ETB.</AlertDescription></Alert>}

            {(currentLoan.collaterals || []).map((collateral, index) => (
                <div key={index} className="space-y-4 p-4 border rounded-md relative">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeCollateral(index)} className="absolute top-2 right-2 text-destructive hover:bg-destructive/10"><MinusCircle className="h-5 w-5" /></Button>
                    <Select value={collateral.type} onValueChange={(val) => handleCollateralTypeChange(index, val as 'GUARANTOR' | 'TITLE_DEED')}>
                        <SelectTrigger><SelectValue placeholder="Select collateral type..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="GUARANTOR">Member Guarantor</SelectItem>
                            <SelectItem value="TITLE_DEED">House Title Deed</SelectItem>
                        </SelectContent>
                    </Select>
                    
                    {collateral.type === 'GUARANTOR' && (
                        <div>
                            <Label>Guarantor Member</Label>
                            <Select onValueChange={(val) => handleCollateralChange(index, 'guarantorId', val)} defaultValue={collateral.guarantorId}>
                                <SelectTrigger><SelectValue placeholder="Select a guarantor..."/></SelectTrigger>
                                <SelectContent>{eligibleGuarantors.map(m => <SelectItem key={m.id} value={m.id}>{m.fullName} (Guaranteed: {m.totalGuaranteed})</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                    {collateral.type === 'TITLE_DEED' && (
                        <div className="space-y-2">
                           <Label>Title Deed Document</Label>
                           <FileUpload id={`title-deed-${index}`} label="Upload Title Deed" value={collateral.documentUrl || ''} onValueChange={(val) => handleCollateralChange(index, 'documentUrl', val)} />
                           <Input name="description" placeholder="Brief description of the property" value={collateral.description || ''} onChange={(e) => handleCollateralChange(index, e.target.name, e.target.value)} />
                        </div>
                    )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addCollateral}><PlusCircle className="mr-2 h-4 w-4" /> Add Collateral</Button>

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








