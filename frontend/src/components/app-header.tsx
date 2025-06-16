import type { FC } from 'react';

const AppHeader: FC = () => {
  return (
    <header className="py-6 md:py-8">
      <div className="container mx-auto px-4 text-center">
        <h1 className="font-headline text-3xl md:text-4xl font-bold">
          <span 
            className="bg-gradient-to-r from-primary via-blue-400 to-teal-400 bg-clip-text text-transparent"
            style={{ textShadow: '0 0 8px hsl(var(--primary)/0.5), 0 0 16px hsl(var(--primary)/0.3)' }}
          >
            Local AI Engineering Tutor
          </span>
        </h1>
      </div>
    </header>
  );
};

export default AppHeader;
