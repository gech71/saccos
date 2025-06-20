
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
  visualization: z.string().describe('The URL or data URI of the generated data visualization. This should be the direct output from the generateDataVisualization tool.'),
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
  prompt: `You are an AI assistant. Your task is to generate a financial report summary and a visualization URL based on the provided school information.

Inputs:
- School Name: {{{schoolName}}}
- Report Type: {{{reportType}}}
- Desired Visualization Type: {{{visualizationType}}}

Instructions:
1.  Call the 'getSchoolFinancialData' tool with the 'schoolName' and 'reportType' to obtain the financial data. The tool will return this data as a JSON string.
2.  Using the financial data (JSON string from step 1), create a concise textual summary for the report. This summary will be the value for the 'report' field.
    Example for a savings report (adapt based on actual data): "For {{{schoolName}}}, total savings were $1,000,000 from 150 members. Average saving: $6,666.67."
3.  Call the 'generateDataVisualization' tool. Pass it the financial data (JSON string from step 1) and the '{{{visualizationType}}}'. The tool will return a URL string for the visualization. This URL will be the value for the 'visualization' field.

Your final response *must* be a JSON object with two keys: "report" (containing the textual summary) and "visualization" (containing the URL from the 'generateDataVisualization' tool).
Adhere strictly to this JSON structure: {"report": "your summary string", "visualization": "your_visualization_url_string"}
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
        console.error('LLM call to savingsReportPrompt did not produce valid output or output was null.', {input, usage});
        throw new Error('Failed to generate report: The AI model did not return the expected data structure. Please check the AI logs for more details.');
    }
    // If we reach here, Genkit has successfully validated the output against GenerateSavingsReportOutputSchema
    return output;
  }
);

export async function generateSavingsReport(input: GenerateSavingsReportInput): Promise<GenerateSavingsReportOutput> {
  return generateSavingsReportFlow(input);
}

export type {DataVisualizationTypeSchema};
