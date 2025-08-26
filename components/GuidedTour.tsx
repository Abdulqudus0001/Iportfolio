import React, { useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';

interface GuidedTourProps {
  onClose: () => void;
}

const steps = [
  {
    title: 'Welcome to iPortfolio!',
    content: 'This quick tour will show you the core features of the app. Let\'s get started!',
  },
  {
    title: '1. The Asset Browser',
    content: 'Here on the "Asset Browser" page, you can search, view details, and create a watchlist of thousands of equities and cryptocurrencies from global markets.',
  },
  {
    title: '2. The Portfolio Builder',
    content: 'Navigate to the "Portfolio" tab to build your own investment portfolio. You can select assets manually or use our intelligent templates to generate one for you.',
  },
  {
    title: '3. Optimize & Analyze',
    content: 'Once your portfolio is built, you can optimize it to find the best asset allocation. Then, head to the "Analytics" tab for deep insights into your creation.',
  },
  {
    title: 'Ready to Explore?',
    content: 'That\'s it! You can change your user tier at any time using the dropdown in the sidebar to unlock more powerful features. Enjoy exploring!',
  },
];

const GuidedTour: React.FC<GuidedTourProps> = ({ onClose }) => {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };
  
  const handlePrev = () => {
      if (step > 0) {
          setStep(step - 1);
      }
  }

  const currentStep = steps[step];

  return (
    <Modal isOpen={true} onClose={onClose} title={currentStep.title}>
        <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">{currentStep.content}</p>
        <div className="flex justify-between items-center">
            <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{step + 1} / {steps.length}</span>
            </div>
            <div className="space-x-2">
                 {step > 0 && <Button variant="secondary" onClick={handlePrev}>Previous</Button>}
                <Button onClick={handleNext}>
                    {step === steps.length - 1 ? 'Finish' : 'Next'}
                </Button>
            </div>
        </div>
    </Modal>
  );
};

export default GuidedTour;