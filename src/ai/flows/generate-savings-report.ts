
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

const getSchoolFinancialDataTool = ai.defineTool({
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
      totalSavings: Math.floor(Math.random() * 500000) + 500000,
      totalShares: Math.floor(Math.random() * 20000) + 30000,
      totalDividends: Math.floor(Math.random() * 5000) + 5000,
      membersAffected: Math.floor(Math.random() * 100) + 50,
      period: "Last Fiscal Year"
    });
  },
});

const generateVisualizationTool = ai.defineTool({
  name: 'generateDataVisualization',
  description: 'Generates a data visualization based on the provided data and visualization type.',
  inputSchema: z.object({
    financialDataJson: z.string().describe('The financial data to visualize (as a JSON string).'),
    visualizationType: DataVisualizationTypeSchema.describe(
      'The type of data visualization to generate (bar chart, pie chart, line chart, or table).'
    ),
  }),
  outputSchema: z.string().describe('The URL or data URI of the generated data visualization.'),
  async fn(input) {
    // TODO: Replace with actual data visualization generation logic.
    // This is a placeholder implementation.
    console.log(
      `Tool 'generateDataVisualization' called. Generating a ${input.visualizationType} chart with data: ${input.financialDataJson}`
    );
    // In a real scenario, you might parse input.data and use a charting library or service.
    const parsedData = JSON.parse(input.financialDataJson);
    const schoolName = parsedData.school || "School";
    const reportType = parsedData.reportType || "Data";
    return `https://placehold.co/600x400.png?text=${input.visualizationType}+chart+for+${encodeURIComponent(reportType)}+at+${encodeURIComponent(schoolName)}`; // Placeholder URL.
  },
});

const SummarizeDataInputSchema = z.object({
    schoolName: z.string().describe('The name of the school.'),
    reportType: z.string().describe('The type of report being summarized.'),
    financialDataJson: z.string().describe('The financial data for the school, as a JSON string.'),
});

const SummarizeDataOutputSchema = z.object({
    summary: z.string().describe('A concise textual summary of the financial report, suitable for display to a user.'),
});

const summarizeDataPrompt = ai.definePrompt({
    name: 'summarizeFinancialDataPrompt',
    input: { schema: SummarizeDataInputSchema },
    output: { schema: SummarizeDataOutputSchema },
    prompt: `Analyze the following financial data for {{schoolName}} regarding their {{reportType}} report.
Financial Data (JSON):
\`\`\`json
{{{financialDataJson}}}
\`\`\`

Your task is to provide a concise, human-readable summary of this data.
Your entire response MUST be a JSON object containing a single key "summary". The value of the "summary" key should be the textual summary.

Example of the exact output format required:
{
  "summary": "For [School Name], the total [report type specific metric, e.g., savings] for the period were $[Amount], contributed by [Number] members. The average [metric] per member was approximately $[Average Amount]."
}

Adapt the example summary structure based on the actual data provided in financialDataJson and the specific reportType. Focus on key figures and insights.
Do not include any text or explanation outside of this JSON object.
`,
});


const generateSavingsReportFlow = ai.defineFlow(
  {
    name: 'generateSavingsReportFlow',
    inputSchema: GenerateSavingsReportInputSchema,
    outputSchema: GenerateSavingsReportOutputSchema,
  },
  async (input) => {
    // Step 1: Get financial data using the tool
    const financialDataJson = await getSchoolFinancialDataTool({
      schoolName: input.schoolName,
      reportType: input.reportType,
    });

    if (!financialDataJson) {
        console.error('Failed to retrieve financial data from getSchoolFinancialDataTool.', {input});
        throw new Error('Financial data retrieval failed.');
    }
    
    // Step 2: Generate visualization using the tool
    const visualizationUrl = await generateVisualizationTool({
      financialDataJson: financialDataJson,
      visualizationType: input.visualizationType,
    });

    if (!visualizationUrl) {
        console.error('Failed to retrieve visualization URL from generateVisualizationTool.', {input, financialDataJson});
        throw new Error('Visualization generation failed.');
    }

    // Step 3: Generate textual summary using the LLM
    const llmSummaryResponse = await summarizeDataPrompt({
        schoolName: input.schoolName,
        reportType: input.reportType,
        financialDataJson: financialDataJson,
    });

    if (!llmSummaryResponse.output || typeof llmSummaryResponse.output.summary !== 'string') {
        console.error('LLM call to summarizeDataPrompt did not produce a valid summary.', {input, financialDataJson, llmUsage: llmSummaryResponse.usage, outputReceived: llmSummaryResponse.output});
        throw new Error('Failed to generate report summary: The AI model did not return the expected text data structure for the summary.');
    }

    // Step 4: Assemble and return the final output
    return {
      report: llmSummaryResponse.output.summary,
      visualization: visualizationUrl,
    };
  }
);

export async function generateSavingsReport(input: GenerateSavingsReportInput): Promise<GenerateSavingsReportOutput> {
  try {
    return await generateSavingsReportFlow(input);
  } catch (error) {
    console.error("Error in generateSavingsReport function:", error);
    // Re-throw the error or handle it by returning a user-friendly error object
    // For this example, re-throwing to be caught by the UI
    throw error; 
  }
}

export type {DataVisualizationTypeSchema};

    