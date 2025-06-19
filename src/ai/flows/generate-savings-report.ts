// use server'
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
  visualization: z.string().describe('The data visualization of the report.'),
});

export type GenerateSavingsReportOutput = z.infer<typeof GenerateSavingsReportOutputSchema>;

const generateSavingsReportTool = ai.defineTool({
  name: 'getSchoolFinancialData',
  description: 'Retrieves the savings, share allocations, and dividend distributions data for a specific school.',
  inputSchema: z.object({
    schoolName: z.string().describe('The name of the school.'),
    reportType: z
      .string()
      .describe(
        'The type of report to generate (savings, share allocations, dividend distributions).'
      ),
  }),
  outputSchema: z.string(),
  async fn(input) {
    // TODO: Replace with actual data retrieval logic from a database or service.
    // This is a placeholder implementation.
    console.log(`Tool was called with ${input.schoolName} and ${input.reportType}`);
    return `{
      school: "${input.schoolName}",
      reportType: "${input.reportType}",
      totalSavings: 1000000,
      totalShares: 50000,
      totalDividends: 10000
    }`;
  },
});

const generateVisualization = ai.defineTool({
  name: 'generateDataVisualization',
  description: 'Generates a data visualization based on the provided data and visualization type.',
  inputSchema: z.object({
    data: z.string().describe('The data to visualize (in JSON format).'),
    visualizationType: DataVisualizationTypeSchema.describe(
      'The type of data visualization to generate (bar chart, pie chart, line chart, or table).'
    ),
  }),
  outputSchema: z.string().describe('The URL or data URI of the generated data visualization.'),
  async fn(input) {
    // TODO: Replace with actual data visualization generation logic.
    // This is a placeholder implementation.
    console.log(
      `Generating a ${input.visualizationType} chart with the following data: ${input.data}`
    );
    return `https://example.com/${input.visualizationType}-chart.png`; // Placeholder URL.
  },
});

const savingsReportPrompt = ai.definePrompt({
  name: 'savingsReportPrompt',
  input: {schema: GenerateSavingsReportInputSchema},
  output: {schema: GenerateSavingsReportOutputSchema},
  tools: [generateSavingsReportTool, generateVisualization],
  prompt: `You are an AI assistant that helps generate financial reports and data visualizations for schools.

  The user will provide the school name, the type of report they need (savings, share allocations, or dividend distributions), and the desired type of data visualization (bar chart, pie chart, line chart, or table).

  First, use the getSchoolFinancialData tool to retrieve the relevant data for the specified school and report type.

  Then, based on the data retrieved and the visualization type specified by the user, use the generateDataVisualization tool to generate the data visualization.

  Finally, generate a concise report summarizing the key findings from the data and provide the URL or data URI of the generated data visualization.

  School Name: {{{schoolName}}}
  Report Type: {{{reportType}}}
  Visualization Type: {{{visualizationType}}}

  Report:
  {{#tool_result}}
  {{#if (eq tool_name "getSchoolFinancialData")}}
  School Data: {{tool_result.result}}
  {{/if}}
  {{/tool_result}}

  Visualization:
  {{#tool_result}}
  {{#if (eq tool_name "generateDataVisualization")}}
  Visualization URL: {{tool_result.result}}
  {{/if}}
  {{/tool_result}}`,
});

const generateSavingsReportFlow = ai.defineFlow(
  {
    name: 'generateSavingsReportFlow',
    inputSchema: GenerateSavingsReportInputSchema,
    outputSchema: GenerateSavingsReportOutputSchema,
  },
  async input => {
    const {output} = await savingsReportPrompt(input);
    return output!;
  }
);

export async function generateSavingsReport(input: GenerateSavingsReportInput): Promise<GenerateSavingsReportOutput> {
  return generateSavingsReportFlow(input);
}

export type {DataVisualizationTypeSchema};
