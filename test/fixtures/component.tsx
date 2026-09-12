import React, { useState, useEffect, useCallback } from 'react';

interface OwnerCardProps {
  ownerId: string;
  compact?: boolean;
  onSelect: (id: string) => void;
}

interface Pet {
  id: string;
  name: string;
  birthDate: string;
}

export function OwnerCard({ ownerId, compact = false, onSelect }: OwnerCardProps) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPets(ownerId).then(setPets).finally(() => setLoading(false));
  }, [ownerId]);

  const handleClick = useCallback(() => onSelect(ownerId), [ownerId, onSelect]);

  if (loading) return <Spinner />;
  return <div onClick={handleClick}>{pets.length} pets</div>;
}

export const PetList: React.FC<{ pets: Pet[] }> = ({ pets }) => (
  <ul>{pets.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
);

export default OwnerCard;
