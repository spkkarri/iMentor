from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ModelContextProtocol(BaseModel):
    """
    Defines the model's current operational environment, available tools, and prior interactions.
    """
    current_mode: str = Field(..., description="The current operational mode of the model (e.g., 'code', 'debug').")
    available_tools: List[str] = Field(default_factory=list, description="List of names of tools available to the model.")
    prior_interactions_summary: Optional[str] = Field(None, description="A summary of previous interactions or chat history.")
    current_cost: Optional[str] = Field(None, description="The current cost incurred during the session.")
    current_context_size: Optional[str] = Field(None, description="The current context size in tokens.")
    # Add other relevant model-specific context as needed, e.g., active models, configurations.

class AgenticContextProtocol(BaseModel):
    """
    Defines the role of the agent, its objectives, long-term goals, constraints, and memory.
    """
    agent_role: str = Field(..., description="The defined role of the agent (e.g., 'software engineer', 'technical leader').")
    agent_objectives: List[str] = Field(default_factory=list, description="Specific objectives for the current task.")
    long_term_goals: List[str] = Field(default_factory=list, description="Long-term goals or overarching aims of the agent.")
    constraints: List[str] = Field(default_factory=list, description="Operational constraints or limitations on the agent's actions.")
    agent_memory_summary: Optional[str] = Field(None, description="A summary of the agent's internal memory or learned information.")
    # Add other relevant agent-specific context as needed, e.g., current task, past decisions.

class ThreadContextProtocol(BaseModel):
    """
    Defines the context for a specific conversation thread.
    """
    thread_id: str = Field(..., description="The unique identifier for the conversation thread.")
    user_id: str = Field(..., description="The ID of the user associated with this thread.")
    thread_summary: Optional[str] = Field(None, description="The current summarized state of the conversation thread.")
    # Add other relevant thread-specific context as needed, e.g., creation time, last active time.

# class PDFExportTool(BaseModel):
#     """
#     Tool for exporting a given string content to a PDF file.
#     Uses the reportlab library for PDF generation.
#     """
#     name: str = Field(default="pdf_export", description="The name of the tool.")
#     description: str = Field(default="Exports a given string or content to a PDF file.", description="Description of the tool.")

#     def export_to_pdf(self, content: str, output_path: str) -> bool:
#         """
#         Exports the provided content string to a PDF file at the specified output path.

#         Args:
#             content (str): The text content to write to the PDF.
#             output_path (str): The file path where the PDF will be saved.

#         Returns:
#             bool: True if export is successful, False otherwise.
#         """
#         try:
#             from reportlab.lib.pagesizes import letter
#             from reportlab.pdfgen import canvas
#             c = canvas.Canvas(output_path, pagesize=letter)
#             width, height = letter
#             # Simple line wrapping for demonstration
#             lines = content.split('\n')
#             y = height - 40
#             for line in lines:
#                 c.drawString(40, y, line[:1000])  # Truncate long lines for safety
#                 y -= 15
#                 if y < 40:
#                     c.showPage()
#                     y = height - 40
#             c.save()
#             return True
#         except Exception as e:
#             import logging
#             logging.getLogger(__name__).error(f"PDF export failed: {e}", exc_info=True)
#             return False

# # Optional: Tool registry stub (expand as needed)
# tool_registry: dict[str, BaseModel] = {}
# tool_registry[PDFExportTool().name] = PDFExportTool()