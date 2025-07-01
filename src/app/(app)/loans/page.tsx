

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter, Check, ChevronsUpDown, FileDown, Banknote, Shield, MinusCircle, Loader2 } from 'lucide-react';
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
import type { Loan, Member, LoanType, Collateral, Address, Organization } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { exportToExcel } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { getLoansPageData, addLoan, updateLoan, deleteLoan, type LoansPageData, type LoanInput } from './actions';
import { useAuth } from '@/contexts/auth-context';

type LoanWithRelations = Loan & { collaterals: (Collateral & { organization: Organization | null, address: Address | null })[] };

const initialCollateralState: Omit<Collateral, 'id' | 'loanId' | 'organizationId' | 'addressId'> = {
  fullName: '',
  organization: null,
  address: null,
};

const initialLoanFormState: Partial<LoanInput & { id?: string }> = {
  memberId: '',
  loanTypeId: '',
  principalAmount: 0,
  disbursementDate: new Date().toISOString().split('T')[0],
  status: 'pending',
  loanAccountNumber: '',
  collaterals: [],
};


export default function LoansPage() {
  const [loans, setLoans] = useState<LoanWithRelations[]>([]);
  const [members, setMembers] = useState<Pick<Member, 'id' | 'fullName'>[]>([]);
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [subcities, setSubcities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const canCreate = user?.permissions.includes('loan:create');
  const canEdit = user?.permissions.includes('loan:edit');
  const canDelete = user?.permissions.includes('loan:delete');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<string | null>(null);

  const [currentLoan, setCurrentLoan] = useState<Partial<LoanInput & {id?: string, status?: string }>>(initialLoanFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);
  const [monthlyPayment, setMonthlyPayment] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  
  const fetchPageData = async () => {
    setIsLoading(true);
    try {
        const data = await getLoansPageData();
        setLoans(data.loans);
        setMembers(data.members);
        setLoanTypes(data.loanTypes);
        setSubcities(data.subcities);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load page data.' });
    }
    setIsLoading(false);
  }

  useEffect(() => {
    fetchPageData();
  }, []);

  useEffect(() => {
    if (currentLoan.loanTypeId && currentLoan.principalAmount && currentLoan.principalAmount > 0) {
        const loanType = loanTypes.find(lt => lt.id === currentLoan.loanTypeId);
        if (loanType && loanType.interestRate > 0 && loanType.loanTerm > 0) {
            const monthlyRate = loanType.interestRate / 12;
            const numberOfPayments = loanType.loanTerm;
            const principal = currentLoan.principalAmount;
            
            const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
            setMonthlyPayment(payment);
        } else if (loanType && loanType.loanTerm > 0) { // Handle 0 interest rate
             const payment = currentLoan.principalAmount / loanType.loanTerm;
             setMonthlyPayment(payment);
        } else {
            setMonthlyPayment(null);
        }
    } else {
        setMonthlyPayment(null);
    }
  }, [currentLoan.principalAmount, currentLoan.loanTypeId, loanTypes]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentLoan(prev => ({ ...prev, [name]: name === 'principalAmount' ? parseFloat(value) : value }));
  };

  const handleSelectChange = (name: keyof LoanInput, value: string) => {
    setCurrentLoan(prev => ({ ...prev, [name]: value }));
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
    const fieldParts = field.split('.');

    if (fieldParts.length > 1) {
        const [parentKey, childKey] = fieldParts as ['organization' | 'address', string];
        const currentParentValue = updatedCollaterals[index][parentKey] || {};
        updatedCollaterals[index] = {
            ...updatedCollaterals[index],
            [parentKey]: {
                ...(currentParentValue as object),
                [childKey]: value
            }
        };
    } else {
        const key = field as keyof typeof initialCollateralState;
        (updatedCollaterals[index] as any)[key] = value;
    }
    
    setCurrentLoan(prev => ({...prev, collaterals: updatedCollaterals}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
        setCurrentLoan(initialLoanFormState);
        setIsEditing(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setCurrentLoan(initialLoanFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (loan: LoanWithRelations) => {
    setCurrentLoan({
      ...loan,
      collaterals: loan.collaterals.map(c => ({
        fullName: c.fullName,
        organization: c.organization ? {...c.organization} : undefined,
        address: c.address ? {...c.address} : undefined
      }))
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
      const member = members.find(m => m.id === loan.memberId);
      const matchesSearchTerm = member ? member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const matchesStatus = selectedStatusFilter === 'all' || loan.status === selectedStatusFilter;
      return matchesSearchTerm && matchesStatus;
    });
  }, [loans, members, searchTerm, selectedStatusFilter]);
  
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
        'Loan Acct. #': loan.loanAccountNumber,
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
      <PageTitle title="Loan Management" subtitle="Manage member loan applications and active loans.">
        <Button onClick={handleExport} variant="outline"><FileDown className="mr-2 h-4 w-4" /> Export</Button>
        {canCreate && <Button onClick={openAddModal}><PlusCircle className="mr-2 h-5 w-5" /> New Loan Application</Button>}
      </PageTitle>

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

      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Acct. #</TableHead>
              <TableHead>Loan Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Principal ($)</TableHead>
              <TableHead className="text-right">Balance ($)</TableHead>
              <TableHead>Disbursed</TableHead>
              <TableHead>Next Due</TableHead>
              <TableHead>Collateral</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={10} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            ) : filteredLoans.length > 0 ? filteredLoans.map(loan => (
              <TableRow key={loan.id}>
                <TableCell className="font-medium">{loan.memberName}</TableCell>
                <TableCell className="font-mono text-xs">{loan.loanAccountNumber}</TableCell>
                <TableCell>{loan.loanTypeName}</TableCell>
                <TableCell><Badge variant={getStatusBadgeVariant(loan.status)}>{loan.status.replace('_', ' ')}</Badge></TableCell>
                <TableCell className="text-right">${loan.principalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right font-semibold">${loan.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell>{new Date(loan.disbursementDate).toLocaleDateString()}</TableCell>
                <TableCell>{loan.nextDueDate ? new Date(loan.nextDueDate).toLocaleDateString() : 'N/A'}</TableCell>
                <TableCell>
                  {loan.collaterals && loan.collaterals.length > 0 ? (
                    <Badge variant="secondary">{loan.collaterals.length} Guarantor(s)</Badge>
                  ) : (
                    <Badge variant="outline">None</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {(canEdit || canDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><span className="sr-only">Menu</span><Banknote className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit && <DropdownMenuItem onClick={() => openEditModal(loan)} disabled={loan.status === 'active' || loan.status === 'paid_off'}><Edit className="mr-2 h-4 w-4" /> Edit Application</DropdownMenuItem>}
                        {canDelete && <DropdownMenuItem onClick={() => openDeleteDialog(loan.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete Application</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={10} className="h-24 text-center">No loans found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Loan Application' : 'New Loan Application'}</DialogTitle>
            <DialogDescription>{isEditing ? 'Update the details for this loan application.' : 'Submit a new loan application for a member for approval.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
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
            <div>
              <Label htmlFor="loanAccountNumber">Loan Account Number (Optional)</Label>
              <Input id="loanAccountNumber" name="loanAccountNumber" value={currentLoan.loanAccountNumber || ''} onChange={handleInputChange} placeholder="Auto-generated if blank" />
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
            {monthlyPayment !== null && (
              <div className="p-3 border rounded-md bg-muted text-sm">
                  <p className="text-muted-foreground">Estimated Monthly Repayment: <span className="font-bold text-primary">${monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
              </div>
            )}
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea id="notes" name="notes" value={currentLoan.notes || ''} onChange={handleInputChange} placeholder="E.g., Purpose of the loan, special conditions." />
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <Label className="font-semibold text-base text-primary">Collateral / Guarantor Information</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addCollateral}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Guarantor
                  </Button>
              </div>

              {(currentLoan.collaterals || []).map((collateral, index) => (
                <div key={index} className="space-y-4 p-4 border rounded-md relative">
                   <Button type="button" variant="ghost" size="icon" onClick={() => removeCollateral(index)} className="absolute top-2 right-2 text-destructive hover:bg-destructive/10">
                      <MinusCircle className="h-5 w-5" />
                      <span className="sr-only">Remove Guarantor</span>
                  </Button>
                  <h4 className="font-medium text-md">Guarantor {index + 1}</h4>
                  <div>
                    <Label htmlFor={`collateral-fullName-${index}`}>Guarantor Full Name</Label>
                    <Input id={`collateral-fullName-${index}`} name="fullName" value={collateral.fullName} onChange={(e) => handleCollateralChange(index, e.target.name, e.target.value)} required />
                  </div>
                  
                  <Label className="font-semibold">Guarantor's Organization</Label>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`collateral-org-name-${index}`}>Organization Name</Label>
                      <Input id={`collateral-org-name-${index}`} name="organization.name" value={collateral.organization?.name || ''} onChange={(e) => handleCollateralChange(index, e.target.name, e.target.value)} />
                    </div>
                     <div>
                      <Label htmlFor={`collateral-org-phone-${index}`}>Organization Phone</Label>
                      <Input id={`collateral-org-phone-${index}`} name="organization.phone" value={collateral.organization?.phone || ''} onChange={(e) => handleCollateralChange(index, e.target.name, e.target.value)} />
                    </div>
                  </div>
                  <div>
                      <Label htmlFor={`collateral-org-address-${index}`}>Organization Address</Label>
                      <Input id={`collateral-org-address-${index}`} name="organization.address" value={collateral.organization?.address || ''} onChange={(e) => handleCollateralChange(index, e.target.name, e.target.value)} />
                  </div>
                  
                  <Label className="font-semibold pt-2 block">Guarantor's Address</Label>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div><Label htmlFor={`collateral-addr-city-${index}`}>City</Label><Input id={`collateral-addr-city-${index}`} name="address.city" value={collateral.address?.city || ''} onChange={(e) => handleCollateralChange(index, e.target.name, e.target.value)} /></div>
                      <div>
                        <Label htmlFor={`collateral-addr-subcity-${index}`}>Sub City</Label>
                        <Select
                          value={collateral.address?.subCity || ''}
                          onValueChange={(value) => handleCollateralChange(index, 'address.subCity', value)}
                        >
                          <SelectTrigger id={`collateral-addr-subcity-${index}`}>
                              <SelectValue placeholder="Select a subcity" />
                          </SelectTrigger>
                          <SelectContent>
                              {subcities.map(sc => (<SelectItem key={sc} value={sc}>{sc}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label htmlFor={`collateral-addr-wereda-${index}`}>Wereda</Label><Input id={`collateral-addr-wereda-${index}`} name="address.wereda" value={collateral.address?.wereda || ''} onChange={(e) => handleCollateralChange(index, e.target.name, e.target.value)} /></div>
                  </div>
                </div>
              ))}
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
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the loan application.
              This will fail if the loan has any repayments associated with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Yes, delete application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
