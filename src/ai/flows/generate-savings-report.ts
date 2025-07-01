
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
import prisma from '@/lib/prisma';

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
    console.log(`Tool 'getSchoolFinancialData' was called with ${input.schoolName} and ${input.reportType}`);
    
    const school = await prisma.school.findUnique({
      where: { name: input.schoolName },
      include: { members: { select: { id: true } } },
    });

    if (!school) {
      return JSON.stringify({ error: `School not found: ${input.schoolName}` });
    }
    
    const memberIds = school.members.map(m => m.id);
    let data: any = {
        school: input.schoolName,
        reportType: input.reportType,
        period: "All Time (Approved)",
    };

    switch(input.reportType) {
        case 'savings':
            const savingsData = await prisma.saving.aggregate({
                where: { memberId: { in: memberIds }, status: 'approved' },
                _sum: { amount: true },
                _count: { id: true },
            });
            const savingsBreakdown = await prisma.saving.groupBy({
                by: ['month'],
                where: { memberId: { in: memberIds }, status: 'approved', transactionType: 'deposit' },
                _sum: { amount: true },
                orderBy: { month: 'asc' }, // Simple sort for now
            });
            data.totalSavings = savingsData._sum.amount || 0;
            data.transactionCount = savingsData._count.id || 0;
            data.breakdown = savingsBreakdown.map(b => ({ month: b.month, value: b._sum.amount }));
            break;
            
        case 'share allocations':
            const sharesData = await prisma.share.aggregate({
                where: { memberId: { in: memberIds }, status: 'approved' },
                _sum: { count: true },
            });
             const sharesBreakdown = await prisma.share.groupBy({
                by: ['shareTypeName'],
                where: { memberId: { in: memberIds }, status: 'approved' },
                _sum: { count: true },
            });
            data.totalShares = sharesData._sum.count || 0;
            data.breakdown = sharesBreakdown.map(b => ({ type: b.shareTypeName, value: b._sum.count }));
            break;
            
        case 'dividend distributions':
            const dividendsData = await prisma.dividend.aggregate({
                 where: { memberId: { in: memberIds }, status: 'approved' },
                _sum: { amount: true },
            });
            const dividendBreakdown = await prisma.dividend.groupBy({
                by: ['distributionDate'],
                 where: { memberId: { in: memberIds }, status: 'approved' },
                _sum: { amount: true },
                 orderBy: { distributionDate: 'asc' },
            });
            data.totalDividends = dividendsData._sum.amount || 0;
            data.breakdown = dividendBreakdown.map(b => ({ date: b.distributionDate.toISOString().split('T')[0], value: b._sum.amount }));
            break;
    }
    
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

const ReportSummarySchema = z.object({
  title: z.string().describe("A short, descriptive title for the report summary."),
  keyInsights: z.array(z.string()).describe("A list of 2-3 key bullet points highlighting the most important findings from the data."),
  narrativeSummary: z.string().describe("A detailed, paragraph-form summary of the financial data, explaining the trends and key figures."),
  dataBreakdownAnalysis: z.string().describe("A brief analysis of the breakdown data (e.g., performance per month, by share type, etc.).")
});

const summarizeDataPrompt = ai.definePrompt({
    name: 'summarizeFinancialDataPrompt',
    input: { schema: z.object({
        schoolName: z.string().describe('The name of the school.'),
        reportType: z.string().describe('The type of report being summarized.'),
        financialDataJson: z.string().describe('The financial data for the school, as a JSON string.'),
    }) },
    output: { schema: ReportSummarySchema }, 
    prompt: `You are a financial analyst for AcademInvest. Your task is to analyze the provided JSON data and generate a structured, professional financial report summary.

Analyze the data for {{schoolName}} regarding their {{reportType}} report.

Provide a clear title for the summary.
Extract 2-3 key insights and present them as a list of bullet points.
Write a comprehensive narrative summary explaining the key figures like totals and counts.
Finally, analyze the data breakdown to describe trends or distributions.

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
    const financialDataJson = await getSchoolFinancialDataTool({
      schoolName: input.schoolName,
      reportType: input.reportType,
    });
    
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
    const summaryObject = summaryResult.output;
    
    if (!summaryObject) {
        console.error('LLM call to summarizeDataPrompt did not produce a valid summary.', {input, financialDataJson, llmUsage: summaryResult.usage, outputReceived: summaryResult.output});
        throw new Error('Failed to generate report summary: The AI model did not return the expected text data.');
    }

    if (!visualizationUrl) {
      console.error('Failed to retrieve visualization URL from generateVisualizationTool.', {input, financialDataJson});
      throw new Error('Visualization generation failed.');
    }

    const formattedReport = `${summaryObject.title}

Key Insights:
${summaryObject.keyInsights.map(insight => `• ${insight}`).join('\n')}

Narrative Summary:
${summaryObject.narrativeSummary}

Breakdown Analysis:
${summaryObject.dataBreakdownAnalysis}
    `.trim();

    return {
      report: formattedReport,
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
