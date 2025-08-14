// frontend/src/components/admin/ExternalServicesNav.jsx
import React from 'react';
import { BarChart3, LayoutDashboard, Search, Bug, DatabaseZap, Share2 } from 'lucide-react';
import Button from '../core/Button';

// URLs for the external services. Kibana is used for Elasticsearch logs.
const services = [
    {
        name: 'Prometheus',
        url: 'http://localhost:2008/targets',
        icon: BarChart3,
        description: 'View application performance metrics and alerts.'
    },
    {
        name: 'Grafana',
        url: 'http://localhost:2009',
        icon: LayoutDashboard,
        description: 'Visualize metrics in custom dashboards.'
    },
    {
        name: 'Kibana',
        url: 'http://localhost:2007/app/discover/',
        icon: Search,
        description: 'Explore, search, and visualize application logs.'
    },
    {
        name: 'Sentry',
        // This URL is constructed based on your SENTRY_DSN.
        // Org ID: o4509804762497024, Project ID: 4509804765577216
        url: 'https://o4509804762497024.sentry.io/issues/?project=4509804765577216',
        icon: Bug,
        description: 'Monitor and debug application errors and crashes.'
    },
    {
        name: 'Qdrant',
        url: 'http://localhost:2003/dashboard',
        icon: DatabaseZap,
        description: 'Inspect the vector database and collections.'
    },
    {
        name: 'Neo4j Browser',
        url: 'http://localhost:2004',
        icon: Share2,
        description: 'Query and visualize the knowledge graph database.'
    }
];

const ExternalServicesNav = () => {
    return (
        <div className="card-base p-4 mb-8">
            <h3 className="text-md font-semibold mb-3 text-text-light dark:text-text-dark">
                Monitoring & Service Dashboards
            </h3>
            <div className="flex flex-wrap items-center gap-3">
                {services.map(service => (
                    <a
                        href={service.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        key={service.name}
                        title={service.description}
                    >
                        <Button variant="outline" size="sm" leftIcon={<service.icon size={14} />}>
                            {service.name}
                        </Button>
                    </a>
                ))}
            </div>
        </div>
    );
};

export default ExternalServicesNav;