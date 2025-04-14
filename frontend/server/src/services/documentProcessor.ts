import { DocumentModel } from '../models/Document';
import { DocumentUploadOptions, DocumentMetadata } from '../../../shared/types';
import pdf from 'pdf-parse';
import fs from 'fs/promises';

export async function processDocument(
    documentId: string,
    filePath: string,
    options: DocumentUploadOptions
): Promise<void> {
    try {
        const document = await DocumentModel.findById(documentId);
        if (!document) {
            throw new Error('Document not found');
        }

        // Read the file
        const dataBuffer = await fs.readFile(filePath);

        // Process PDF
        if (document.type === 'pdf') {
            const pdfData = await pdf(dataBuffer);

            // Update document with extracted data
            document.pages = pdfData.numpages;
            document.content = pdfData.text;

            if (options.generateSummary) {
                // TODO: Implement AI summary generation
                document.summary = "Summary will be generated here...";
            }

            if (options.extractMetadata) {
                const metadata: DocumentMetadata = {
                    author: pdfData.info?.Author || undefined,
                    createdDate: pdfData.info?.CreationDate ? new Date(pdfData.info.CreationDate) : undefined,
                    keywords: pdfData.info?.Keywords?.split(',').map((k: string) => k.trim()) || [],
                    ...pdfData.info
                };
                document.metadata = metadata;
            }

            // Handle OCR if enabled and needed
            if (options.ocrEnabled && !document.content?.trim()) {
                // TODO: Implement OCR processing
                console.log('OCR processing would happen here');
            }
        }
        // TODO: Add support for other document types (Word, etc.)

        // Generate thumbnail
        // TODO: Implement thumbnail generation
        document.thumbnail = "default-thumbnail.png";

        // Update status
        document.status = 'ready';
        await document.save();

        // Clean up uploaded file
        await fs.unlink(filePath);
    } catch (error) {
        console.error('Error processing document:', error);

        // Update document with error status
        const document = await DocumentModel.findById(documentId);
        if (document) {
            document.status = 'error';
            document.error = error instanceof Error ? error.message : 'Unknown error occurred';
            await document.save();
        }

        // Clean up uploaded file
        try {
            await fs.unlink(filePath);
        } catch (unlinkError) {
            console.error('Error deleting uploaded file:', unlinkError);
        }

        throw error;
    }
} 