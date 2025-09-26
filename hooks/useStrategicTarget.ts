import useLocalStorage from './useLocalStorage';

export const useStrategicTarget = () => {
  const [targetId, setTargetId] = useLocalStorage<number | null>('iportfolio-strategic-target-id', null);

  return { targetId, setTargetId };
};