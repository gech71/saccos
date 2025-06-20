
'use server';

/**
 * @fileOverview Generates a report summarizing member savings, share allocations, and dividend distributions for a specific school.
 *
 * - generateSavingsReport - A function that generates the savings report.
 * - GenerateSavingsReportInput - The input type for the generateSavingsReport function.
 * - GenerateSavingsReportOutput - The return type for the generateSavingsReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DataVisualizationTypeSchema = z.enum(['bar', 'pie', 'line', 'table']);

const GenerateSavingsReportInputSchema = z.object({
  schoolName: z.string().describe('The name of the school to generate the report for.'),
  reportType: z
    .string()
    .describe(
      'The type of report to generate (savings, share allocations, dividend distributions).'
    ),
  visualizationType: DataVisualizationTypeSchema.default('bar').describe(
    'The type of data visualization to generate (bar chart, pie chart, line chart, or table). Defaults to bar chart for tabular data.'
  ),
});
export type GenerateSavingsReportInput = z.infer<typeof GenerateSavingsReportInputSchema>;

const GenerateSavingsReportOutputSchema = z.object({
  report: z.string().describe('The generated report summarizing the data.'),
  visualization: z.string().describe('The URL or data URI of the generated data visualization.'),
});

export type GenerateSavingsReportOutput = z.infer<typeof GenerateSavingsReportOutputSchema>;

const generateSavingsReportTool = ai.defineTool({
  name: 'getSchoolFinancialData',
  description: 'Retrieves the savings, share allocations, and dividend distributions data for a specific school. The data is returned as a JSON string.',
  inputSchema: z.object({
    schoolName: z.string().describe('The name of the school.'),
    reportType: z
      .string()
      .describe(
        'The type of report to generate (savings, share allocations, dividend distributions).'
      ),
  }),
  outputSchema: z.string().describe('A JSON string containing the financial data.'),
  async fn(input) {
    // TODO: Replace with actual data retrieval logic from a database or service.
    // This is a placeholder implementation.
    console.log(`Tool 'getSchoolFinancialData' was called with ${input.schoolName} and ${input.reportType}`);
    return JSON.stringify({ // Ensure the output is a valid JSON string
      school: input.schoolName,
      reportType: input.reportType,
      totalSavings: 1000000,
      totalShares: 50000,
      totalDividends: 10000,
      membersAffected: Math.floor(Math.random() * 100) + 50,
      period: "Last Fiscal Year"
    });
  },
});

const generateVisualization = ai.defineTool({
  name: 'generateDataVisualization',
  description: 'Generates a data visualization based on the provided data and visualization type.',
  inputSchema: z.object({
    data: z.string().describe('The financial data to visualize (as a JSON string).'),
    visualizationType: DataVisualizationTypeSchema.describe(
      'The type of data visualization to generate (bar chart, pie chart, line chart, or table).'
    ),
  }),
  outputSchema: z.string().describe('The URL or data URI of the generated data visualization.'),
  async fn(input) {
    // TODO: Replace with actual data visualization generation logic.
    // This is a placeholder implementation.
    console.log(
      `Tool 'generateDataVisualization' called. Generating a ${input.visualizationType} chart with data: ${input.data}`
    );
    // In a real scenario, you might parse input.data and use a charting library or service.
    return `https://placehold.co/600x400.png?text=${input.visualizationType}+chart+for+report`; // Placeholder URL.
  },
});

const savingsReportPrompt = ai.definePrompt({
  name: 'savingsReportPrompt',
  input: {schema: GenerateSavingsReportInputSchema},
  output: {schema: GenerateSavingsReportOutputSchema}, // The LLM must generate output matching this schema
  tools: [generateSavingsReportTool, generateVisualization],
  prompt: `You are an AI assistant tasked with generating a financial report.
Given the School Name: {{{schoolName}}}, Report Type: {{{reportType}}}, and desired Visualization Type: {{{visualizationType}}}.

Follow these steps carefully:
1.  Use the 'getSchoolFinancialData' tool to retrieve the financial data for the specified school and report type.
2.  Analyze the retrieved financial data (which will be a JSON string).
3.  Based on your analysis, write a concise summary. This summary will be the value for the 'report' field in your JSON output. Make sure to mention key figures from the data.
4.  Using the same retrieved financial data (the JSON string from step 1) and the specified '{{{visualizationType}}}', use the 'generateDataVisualization' tool to create a visual representation of the data.
5.  The URL or data URI returned by the 'generateDataVisualization' tool will be the value for the 'visualization' field in your JSON output.

Your final response MUST be a valid JSON object adhering to the defined output schema. It should contain both the 'report' summary and the 'visualization' URL/data URI.
Example of a good report summary for savings: "For {{{schoolName}}}, the total savings for the last fiscal year amounted to $1,000,000, involving 150 members. The average saving per member was approximately $6,666.67." (Adjust details based on actual tool output).
`,
});

const generateSavingsReportFlow = ai.defineFlow(
  {
    name: 'generateSavingsReportFlow',
    inputSchema: GenerateSavingsReportInputSchema,
    outputSchema: GenerateSavingsReportOutputSchema,
  },
  async input => {
    const {output, usage} = await savingsReportPrompt(input);
    if (!output) {
        console.error('LLM call to savingsReportPrompt did not produce valid output conforming to the schema.', {input, usage});
        throw new Error('Failed to generate report: The AI model did not return the expected data structure. Please check the AI logs for more details.');
    }
    return output;
  }
);

export async function generateSavingsReport(input: GenerateSavingsReportInput): Promise<GenerateSavingsReportOutput> {
  return generateSavingsReportFlow(input);
}

export type {DataVisualizationTypeSchema};
