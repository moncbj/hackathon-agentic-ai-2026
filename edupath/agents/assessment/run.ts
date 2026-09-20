import { generateStructured } from '@/lib/gemini/generate-structured';
import { AssessmentGenerateOutput, AssessmentGenerateOutputSchema } from './schema';
export interface AssessmentGenerateInput { skill:{slug:string;name:string;description:string}; targetLevel:number; levelDescription:string; language:string; mix:{multipleChoice:3;shortAnswer:2}; previousPrompts:string[] }
export async function runAssessmentGenerate(input:AssessmentGenerateInput):Promise<AssessmentGenerateOutput>{return generateStructured({schema:AssessmentGenerateOutputSchema,systemPrompt:'Generate exactly three multiple choice and two short answer assessment questions. Return JSON only.',input:JSON.stringify(input),fixtureKey:'assessment-generate'});}
