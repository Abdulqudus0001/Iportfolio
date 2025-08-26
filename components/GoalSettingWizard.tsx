import React, { useState } from 'react';
import { Goal, GoalSettings } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';

interface GoalSettingWizardProps {
  onClose: () => void;
  onComplete: (settings: GoalSettings) => void;
}

const steps = [
  { id: 'goal', title: 'What is your primary investment goal?' },
  { id: 'timeline', title: 'What is your investment timeline?' },
  { id: 'risk', title: 'How would you describe your risk tolerance?' },
  { id: 'summary', title: 'Your Recommended Strategy' },
];

const GoalSettingWizard: React.FC<GoalSettingWizardProps> = ({ onClose, onComplete }) => {
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState<GoalSettings>({
    goal: Goal.WealthGrowth,
    timeline: 10,
    riskTolerance: 'Moderate',
  });

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(settings);
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const renderStepContent = () => {
    const currentStepId = steps[step].id;
    switch (currentStepId) {
      case 'goal':
        return (
          <div className="space-y-2">
            {Object.values(Goal).map(goal => (
              <button
                key={goal}
                onClick={() => setSettings({ ...settings, goal })}
                className={`w-full p-3 border rounded-lg text-left transition-colors ${settings.goal === goal ? 'bg-blue-100 border-brand-primary dark:bg-blue-900' : 'hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'}`}
              >
                {goal}
              </button>
            ))}
          </div>
        );
      case 'timeline':
        return (
            <div>
                <label className="block text-center text-lg font-semibold mb-2">{settings.timeline} years</label>
                <input
                    type="range"
                    min="1"
                    max="30"
                    value={settings.timeline}
                    onChange={(e) => setSettings({ ...settings, timeline: parseInt(e.target.value, 10) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                 <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>1 year</span>
                    <span>30 years</span>
                </div>
            </div>
        );
      case 'risk':
        return (
            <div className="space-y-2">
                {(['Conservative', 'Moderate', 'Aggressive'] as const).map(risk => (
                     <button
                        key={risk}
                        onClick={() => setSettings({ ...settings, riskTolerance: risk })}
                        className={`w-full p-3 border rounded-lg text-left transition-colors ${settings.riskTolerance === risk ? 'bg-blue-100 border-brand-primary dark:bg-blue-900' : 'hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'}`}
                    >
                        <h4 className="font-semibold">{risk}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            {risk === 'Conservative' && 'I prioritize protecting my principal and am willing to accept lower returns.'}
                            {risk === 'Moderate' && 'I am willing to accept some risk for potentially higher long-term returns.'}
                            {risk === 'Aggressive' && 'I am comfortable with significant market fluctuations for the highest growth potential.'}
                        </p>
                    </button>
                ))}
            </div>
        );
      case 'summary':
         let recommendedTemplate = 'Balanced';
         if(settings.riskTolerance === 'Aggressive' || settings.timeline > 20) {
            recommendedTemplate = 'Aggressive';
        } else if (settings.riskTolerance === 'Conservative' && settings.timeline < 5) {
            recommendedTemplate = 'ESG';
        }
        return (
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="text-xl font-bold text-brand-primary">We recommend the '{recommendedTemplate}' strategy.</h3>
                <p className="mt-2 text-gray-700 dark:text-gray-300">
                    This strategy is a good starting point based on your goal of '{settings.goal}', a {settings.timeline}-year timeline, and a {settings.riskTolerance.toLowerCase()} risk tolerance.
                </p>
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    Click "Finish" to set this strategy in the Portfolio Builder. You can always change it later.
                </p>
            </div>
        );
      default:
        return null;
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={steps[step].title}>
      <div className="min-h-[200px] flex items-center justify-center">
        {renderStepContent()}
      </div>
      <div className="flex justify-between items-center mt-6">
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

export default GoalSettingWizard;