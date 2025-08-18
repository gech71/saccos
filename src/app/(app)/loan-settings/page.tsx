
'use client';

import React, { useState, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Percent, DollarSign } from 'lucide-react';
import { getLoanSettings, updateLoanSettings, type LoanSettings } from './actions';

export default function LoanSettingsPage() {
    const [settings, setSettings] = useState<LoanSettings>({ serviceFee: 0, insuranceFeePercentage: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        async function fetchSettings() {
            setIsLoading(true);
            try {
                const data = await getLoanSettings();
                setSettings(data);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load loan settings.' });
            }
            setIsLoading(false);
        }
        fetchSettings();
    }, [toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: parseFloat(value) || 0
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await updateLoanSettings(settings);
            toast({ title: 'Success', description: 'Loan settings updated successfully.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save settings.' });
        }
        setIsSubmitting(false);
    };
    
    if (isLoading) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <PageTitle title="Loan Settings" subtitle="Configure default fees for Regular Loan applications." />
            
            <form onSubmit={handleSubmit}>
                <Card className="max-w-2xl mx-auto shadow-lg">
                    <CardHeader>
                        <CardTitle>Default Fees</CardTitle>
                        <CardDescription>These values are used when creating new "Regular Loan" applications.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <Label htmlFor="serviceFee">Service Fee (ETB)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="serviceFee"
                                    name="serviceFee"
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={settings.serviceFee}
                                    onChange={handleInputChange}
                                    className="pl-7"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">A flat fee applied to each Regular Loan.</p>
                        </div>
                        <div>
                            <Label htmlFor="insuranceFeePercentage">Insurance Fee (%)</Label>
                            <div className="relative">
                                <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="insuranceFeePercentage"
                                    name="insuranceFeePercentage"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={settings.insuranceFeePercentage}
                                    onChange={handleInputChange}
                                    className="pr-8"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">A percentage of the principal amount applied as an insurance fee for Regular Loans.</p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting} className="ml-auto">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Save Settings
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
