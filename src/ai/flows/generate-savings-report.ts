
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
    // This is a placeholder implementation.
    console.log(`Tool 'getSchoolFinancialData' was called with ${input.schoolName} and ${input.reportType}`);
    const data = {
      school: input.schoolName,
      reportType: input.reportType,
      totalSavings: Math.floor(Math.random() * 500000) + 500000,
      totalShares: Math.floor(Math.random() * 20000) + 30000,
      totalDividends: Math.floor(Math.random() * 5000) + 5000,
      membersAffected: Math.floor(Math.random() * 100) + 50,
      period: "Last Fiscal Year",
      breakdown: [
          { month: 'Jan', value: Math.floor(Math.random() * 10000) + 5000 },
          { month: 'Feb', value: Math.floor(Math.random() * 10000) + 5000 },
          { month: 'Mar', value: Math.floor(Math.random() * 10000) + 5000 },
          { month: 'Apr', value: Math.floor(Math.random() * 10000) + 5000 },
      ]
    };
    return JSON.stringify(data);
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
    schoolName: z.string().describe("The name of the school for the chart title."),
    reportType: z.string().describe("The type of report for the chart title.")
  }),
  outputSchema: z.string().describe('The data URI of the generated data visualization.'),
  async fn(input) {
    console.log(
      `Tool 'generateDataVisualization' called. Generating a ${input.visualizationType} chart with data: ${input.financialDataJson}`
    );
    
    try {
        const { media } = await ai.generate({
          model: 'googleai/gemini-2.0-flash-preview-image-generation',
          prompt: `Generate a professional and clean ${input.visualizationType} chart for a financial report. The chart title should be "${input.reportType} for ${input.schoolName}". Use the following data: ${input.financialDataJson}. Make the chart visually appealing with a clear legend.`,
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        });

        if (!media?.url) {
            console.error('Image generation failed: no media URL returned.');
            throw new Error('Failed to generate visualization image.');
        }

        return media.url; // This will be a data URI "data:image/png;base64,..."
    } catch (e) {
        console.error('Error during image generation:', e);
        // Fallback to a placeholder if image generation fails
        return `https://placehold.co/600x400.png`;
    }
  },
});

const summarizeDataPrompt = ai.definePrompt({
    name: 'summarizeFinancialDataPrompt',
    input: { schema: z.object({
        schoolName: z.string().describe('The name of the school.'),
        reportType: z.string().describe('The type of report being summarized.'),
        financialDataJson: z.string().describe('The financial data for the school, as a JSON string.'),
    }) },
    // Output is now just a string, which is more robust.
    output: { schema: z.string() }, 
    prompt: `You are a financial analyst. Analyze the following JSON data for {{schoolName}} regarding their {{reportType}} report and provide a concise, human-readable summary.
Focus on the key figures and provide a clear, professional summary.

Financial Data:
\`\`\`json
{{{financialDataJson}}}
\`\`\`
`,
});


const generateSavingsReportFlow = ai.defineFlow(
  {
    name: 'generateSavingsReportFlow',
    inputSchema: GenerateSavingsReportInputSchema,
    outputSchema: GenerateSavingsReportOutputSchema,
  },
  async (input) => {
    // Step 1: Get financial data
    const financialDataJson = await getSchoolFinancialDataTool({
      schoolName: input.schoolName,
      reportType: input.reportType,
    });
    
    // Step 2 & 3 can run in parallel for better performance
    const [visualizationResult, summaryResult] = await Promise.all([
        generateVisualizationTool({
            financialDataJson,
            visualizationType: input.visualizationType,
            schoolName: input.schoolName,
            reportType: input.reportType,
        }),
        summarizeDataPrompt({
            schoolName: input.schoolName,
            reportType: input.reportType,
            financialDataJson,
        })
    ]);

    const visualizationUrl = visualizationResult;
    const summaryText = summaryResult.output;
    
    if (!summaryText) {
        console.error('LLM call to summarizeDataPrompt did not produce a valid summary.', {input, financialDataJson, llmUsage: summaryResult.usage, outputReceived: summaryResult.output});
        throw new Error('Failed to generate report summary: The AI model did not return the expected text data.');
    }

    if (!visualizationUrl) {
      console.error('Failed to retrieve visualization URL from generateVisualizationTool.', {input, financialDataJson});
      throw new Error('Visualization generation failed.');
    }

    // Step 4: Assemble and return the final output
    return {
      report: summaryText,
      visualization: visualizationUrl,
    };
  }
);

export async function generateSavingsReport(input: GenerateSavingsReportInput): Promise<GenerateSavingsReportOutput> {
  try {
    return await generateSavingsReportFlow(input);
  } catch (error) {
    console.error("Error in generateSavingsReport function:", error);
    throw error; 
  }
}

export type {DataVisualizationTypeSchema};
