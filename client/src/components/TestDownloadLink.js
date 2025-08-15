/**
 * Test Download Link Component
 * Simple test component to verify DownloadLink functionality
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import DownloadLink from './DownloadLink';

const TestDownloadLink = () => {
    const testMarkdown = `
# Test Download Links

Here are some test download links:

1. [📥 Download PDF](http://localhost:4007/api/files/download-generated/test.pdf)
2. [📊 Download PPT](http://localhost:4007/api/files/download-generated/test.pptx)
3. [📄 Download DOC](http://localhost:4007/api/files/download-generated/test.docx)
4. [📈 Download XLS](http://localhost:4007/api/files/download-generated/test.xlsx)
5. [🌐 Regular Link](https://www.google.com)

## Direct Component Test

Below is a direct DownloadLink component:
`;

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h2>🧪 Download Link Test</h2>
            
            <div style={{ marginBottom: '30px' }}>
                <h3>ReactMarkdown with DownloadLink</h3>
                <ReactMarkdown
                    components={{
                        a: ({node, ...props}) => (
                            <DownloadLink {...props} />
                        )
                    }}
                >
                    {testMarkdown}
                </ReactMarkdown>
            </div>
            
            <div style={{ marginBottom: '30px' }}>
                <h3>Direct DownloadLink Components</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <DownloadLink href="http://localhost:4007/api/files/download-generated/test.pdf">
                        📥 Direct PDF Download
                    </DownloadLink>
                    <DownloadLink href="http://localhost:4007/api/files/download-generated/test.pptx">
                        📊 Direct PPT Download
                    </DownloadLink>
                    <DownloadLink href="https://www.google.com">
                        🌐 Regular Link (should open in new tab)
                    </DownloadLink>
                </div>
            </div>
            
            <div style={{ marginBottom: '30px' }}>
                <h3>Standard ReactMarkdown (without DownloadLink)</h3>
                <ReactMarkdown>
                    {`[📥 Standard Link](http://localhost:4007/api/files/download-generated/test.pptx) - This should cause page reload`}
                </ReactMarkdown>
            </div>
        </div>
    );
};

export default TestDownloadLink;
