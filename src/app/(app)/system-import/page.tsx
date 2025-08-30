'use client';

import React, { useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileDown, UploadCloud, CheckCircle, XCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import * as XLSX from 'xlsx';
import { exportToExcel } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { getImportPrerequisites, importMembers, type ImportedMember } from './actions';

type ParsedMember = ImportedMember & {
  status: 'Ready to import' | 'Duplicate in file' | 'Already exists in DB' | 'Invalid ID or Name' | 'Invalid School ID';
};

export default function SystemImportPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [parsedMembers, setParsedMembers] = useState<ParsedMember[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const canCreate = user?.permissions.includes('systemImport:create');

  const handleDownloadTemplate = () => {
    const templateData = [{
      MemberID: 'EMP001',
      MemberFullName: 'John Doe',
      InitialSavingsBalance: 500.00,
      SchoolID: 'school-id-from-schools-page',
      Salary: 50000,
    }];
    exportToExcel(templateData, 'member_import_template');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsParsing(true);
      setParsedMembers([]);
      
      try {
        const { existingMemberIds, existingSchoolIds } = await getImportPrerequisites();
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const dataRows = XLSX.utils.sheet_to_json<any>(worksheet);

        const seenInFile = new Set<string>();
        const validatedData: ParsedMember[] = dataRows.map(row => {
          const memberId = row['MemberID']?.toString().trim();
          const fullName = row['MemberFullName']?.toString().trim();
          const schoolId = row['SchoolID']?.toString().trim();
          const initialBalance = parseFloat(row['InitialSavingsBalance']);
          const salary = row['Salary'] ? parseFloat(row['Salary']) : undefined;

          let status: ParsedMember['status'] = 'Ready to import';

          if (!memberId || !fullName || !schoolId || isNaN(initialBalance)) {
            status = 'Invalid ID or Name';
          } else if (!existingSchoolIds.has(schoolId)) {
            status = 'Invalid School ID';
          } else if (existingMemberIds.has(memberId)) {
            status = 'Already exists in DB';
          } else if (seenInFile.has(memberId)) {
            status = 'Duplicate in file';
          }
          seenInFile.add(memberId);

          return { MemberID: memberId, MemberFullName: fullName, SchoolID: schoolId, InitialSavingsBalance: initialBalance, Salary: salary, status };
        });
        
        setParsedMembers(validatedData);

      } catch (error) {
        toast({ variant: 'destructive', title: 'Parsing Error', description: 'Could not process file. Ensure it has required columns: "MemberID", "MemberFullName", "InitialSavingsBalance", and "SchoolID".' });
      } finally {
        setIsParsing(false);
      }
    }
  };
  
  const handleConfirmImport = async () => {
    const membersToImport = parsedMembers.filter(m => m.status === 'Ready to import');

    if (membersToImport.length === 0) {
      toast({ title: 'No New Members', description: 'There are no new members ready to import from the file.' });
      return;
    }

    setIsSubmitting(true);
    try {
        const result = await importMembers(membersToImport);
        toast({ title: 'Import Complete', description: result.message });
        setParsedMembers([]); // Clear the list after successful import
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred during import.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getValidationBadge = (status: ParsedMember['status']) => {
    switch (status) {
      case 'Ready to import': return <Badge variant="default" className="bg-green-600 hover:bg-green-700"><CheckCircle className="mr-1 h-3 w-3" />Ready</Badge>;
      case 'Already exists in DB': return <Badge variant="secondary"><AlertCircle className="mr-1 h-3 w-3" />Exists</Badge>;
      case 'Duplicate in file': return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Duplicate</Badge>;
      case 'Invalid ID or Name': return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Invalid Data</Badge>;
      case 'Invalid School ID': return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Invalid School</Badge>;
    }
  };

  const importStats = useMemo(() => {
    const ready = parsedMembers.filter(p => p.status === 'Ready to import').length;
    const skipped = parsedMembers.length - ready;
    return { ready, skipped };
  }, [parsedMembers]);

  return (
    <div className="space-y-6">
      <PageTitle title="System Data Import" subtitle="Bulk import member data for initial system setup." />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>1. Download Template</CardTitle>
          <CardDescription>
            Download the Excel template file. This ensures your data is in the correct format for a successful import.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={handleDownloadTemplate}>
            <FileDown className="mr-2 h-4 w-4" /> Download Template
          </Button>
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Important Notes</AlertTitle>
            <AlertDescription>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>`MemberID` and `SchoolID` must match existing records in the system.</li>
                    <li>A default temporary password ("123456") will be assigned to all new members.</li>
                    <li>A default "Regular Savings" account will be created for each new member with the specified initial balance.</li>
                </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      
       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>2. Upload and Preview</CardTitle>
          <CardDescription>
            Upload your completed Excel file. The system will validate the data and show a preview before importing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="importFile">Upload File</Label>
              <Input id="importFile" type="file" onChange={handleFileChange} accept=".xlsx, .xls" disabled={isParsing || isSubmitting} />
            </div>
            {isParsing && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span>Validating file...</span></div>}
            
            {parsedMembers.length > 0 && (
              <div className="space-y-2">
                <Label>Import Preview & Validation</Label>
                <div className="h-80 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                      <TableRow>
                        <TableHead>Member ID</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead className="text-right">Initial Balance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedMembers.map((member, index) => (
                        <TableRow key={index} data-status={member.status}>
                          <TableCell>{member.MemberID}</TableCell>
                          <TableCell>{member.MemberFullName}</TableCell>
                          <TableCell className="text-right">{member.InitialSavingsBalance.toFixed(2)}</TableCell>
                          <TableCell>{getValidationBadge(member.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                 <div className="text-sm text-muted-foreground flex justify-between">
                    <span><span className="font-bold text-green-600">{importStats.ready}</span> row(s) ready to import.</span>
                    <span><span className="font-bold text-destructive">{importStats.skipped}</span> row(s) will be skipped.</span>
                 </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
            {canCreate && (
                <Button onClick={handleConfirmImport} disabled={isSubmitting || isParsing || importStats.ready === 0}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                    Confirm and Import {importStats.ready > 0 ? `(${importStats.ready})` : ''} Members
                </Button>
            )}
        </CardFooter>
      </Card>
    </div>
  );
}
