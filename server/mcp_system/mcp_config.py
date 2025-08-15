#!/usr/bin/env python3
"""
MCP Configuration for Real Integrations
"""

import os
from typing import Dict, Any, Optional

class MCPConfig:
    """Configuration manager for MCP real integrations"""
    
    def __init__(self):
        self.config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from environment variables"""
        return {
            # GitHub Integration
            'github': {
                'token': os.getenv('GITHUB_TOKEN'),
                'enabled': bool(os.getenv('GITHUB_TOKEN')),
                'base_url': 'https://api.github.com'
            },
            
            # Google Calendar Integration
            'google_calendar': {
                'credentials_file': os.getenv('GOOGLE_CALENDAR_CREDENTIALS'),
                'enabled': bool(os.getenv('GOOGLE_CALENDAR_CREDENTIALS')),
                'api_version': 'v3'
            },
            
            # Email Integration
            'email': {
                'smtp_server': os.getenv('SMTP_SERVER', 'smtp.gmail.com'),
                'smtp_port': int(os.getenv('SMTP_PORT', '587')),
                'username': os.getenv('EMAIL_USERNAME'),
                'password': os.getenv('EMAIL_PASSWORD'),
                'enabled': bool(os.getenv('EMAIL_USERNAME') and os.getenv('EMAIL_PASSWORD'))
            },
            
            # SMS Integration (Twilio)
            'sms': {
                'account_sid': os.getenv('TWILIO_ACCOUNT_SID'),
                'auth_token': os.getenv('TWILIO_AUTH_TOKEN'),
                'phone_number': os.getenv('TWILIO_PHONE_NUMBER'),
                'enabled': bool(os.getenv('TWILIO_ACCOUNT_SID') and os.getenv('TWILIO_AUTH_TOKEN'))
            },
            
            # Academic Search (IEEE, ACM APIs)
            'academic_search': {
                'ieee_api_key': os.getenv('IEEE_API_KEY'),
                'acm_api_key': os.getenv('ACM_API_KEY'),
                'enabled': bool(os.getenv('IEEE_API_KEY') or os.getenv('ACM_API_KEY'))
            },
            
            # Job Search APIs
            'job_search': {
                'linkedin_api_key': os.getenv('LINKEDIN_API_KEY'),
                'indeed_api_key': os.getenv('INDEED_API_KEY'),
                'enabled': bool(os.getenv('LINKEDIN_API_KEY') or os.getenv('INDEED_API_KEY'))
            }
        }
    
    def is_integration_enabled(self, integration_name: str) -> bool:
        """Check if a specific integration is enabled"""
        return self.config.get(integration_name, {}).get('enabled', False)
    
    def get_integration_config(self, integration_name: str) -> Dict[str, Any]:
        """Get configuration for a specific integration"""
        return self.config.get(integration_name, {})
    
    def get_status_report(self) -> Dict[str, Any]:
        """Get status report of all integrations"""
        status = {}
        for integration, config in self.config.items():
            status[integration] = {
                'enabled': config.get('enabled', False),
                'status': 'Ready' if config.get('enabled', False) else 'Not Configured'
            }
        return status
    
    def get_setup_instructions(self) -> Dict[str, str]:
        """Get setup instructions for enabling real integrations"""
        return {
            'github': """
To enable REAL GitHub repository creation:
1. Create a GitHub Personal Access Token:
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Generate new token with 'repo' permissions
2. Set environment variable: GITHUB_TOKEN=your_token_here
3. Restart the application
            """,
            
            'google_calendar': """
To enable REAL Google Calendar integration:
1. Create Google Calendar API credentials:
   - Go to Google Cloud Console
   - Enable Calendar API
   - Create service account credentials
2. Download credentials JSON file
3. Set environment variable: GOOGLE_CALENDAR_CREDENTIALS=path/to/credentials.json
4. Restart the application
            """,
            
            'email': """
To enable REAL email sending:
1. Set up email credentials:
   - For Gmail: Enable 2FA and create App Password
2. Set environment variables:
   - EMAIL_USERNAME=your_email@gmail.com
   - EMAIL_PASSWORD=your_app_password
   - SMTP_SERVER=smtp.gmail.com (optional, defaults to Gmail)
3. Restart the application
            """,
            
            'sms': """
To enable REAL SMS notifications:
1. Create Twilio account and get credentials
2. Set environment variables:
   - TWILIO_ACCOUNT_SID=your_account_sid
   - TWILIO_AUTH_TOKEN=your_auth_token
   - TWILIO_PHONE_NUMBER=your_twilio_number
3. Restart the application
            """,
            
            'academic_search': """
To enable REAL academic paper search:
1. Get API keys from IEEE and/or ACM
2. Set environment variables:
   - IEEE_API_KEY=your_ieee_key
   - ACM_API_KEY=your_acm_key
3. Restart the application
            """,
            
            'job_search': """
To enable REAL job search and applications:
1. Get API keys from LinkedIn and/or Indeed
2. Set environment variables:
   - LINKEDIN_API_KEY=your_linkedin_key
   - INDEED_API_KEY=your_indeed_key
3. Restart the application
            """
        }

# Global config instance
mcp_config = MCPConfig()
