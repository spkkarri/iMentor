// frontend/src/components/profile/ProfileSettingsModal.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Modal from '../core/Modal.jsx';
import Button from '../core/Button.jsx';
import { Save, User, School, Hash, Award, Wrench, Calendar } from 'lucide-react';

const ProfileSettingsModal = ({ isOpen, onClose }) => {
    const [profile, setProfile] = useState({
        name: '',
        college: '',
        universityNumber: '',
        degreeType: '',
        branch: '',
        year: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            const fetchProfile = async () => {
                setIsLoading(true);
                setError('');
                try {
                    const data = await api.getUserProfile();
                    // Set profile data, ensuring defaults for any missing fields
                    setProfile({
                        name: data.name || '',
                        college: data.college || '',
                        universityNumber: data.universityNumber || '',
                        degreeType: data.degreeType || 'Bachelors', // Default value
                        branch: data.branch || 'Computer Science', // Default value
                        year: data.year || '1st Year' // Default value
                    });
                } catch (err) {
                    toast.error('Failed to load profile data.');
                    setError(err.message || 'Could not fetch profile.');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchProfile();
        }
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Simple validation
        for (const key in profile) {
            if (!profile[key] || profile[key].trim() === '') {
                toast.error(`Please fill out the '${key.replace(/([A-Z])/g, ' $1').trim()}' field.`);
                return;
            }
        }
        setIsLoading(true);
        setError('');
        try {
            const response = await api.updateUserProfile(profile);
            toast.success(response.message || 'Profile updated successfully!');
            onClose();
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to update profile.';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const inputWrapperClass = "relative";
    const inputIconClass = "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted-light dark:text-text-muted-dark pointer-events-none";
    const inputFieldStyledClass = "input-field pl-10 py-2.5 text-sm";
    const selectFieldStyledClass = "input-field !pl-10 !pr-8 py-2.5 text-sm";

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Student Profile Settings"
            size="lg"
            footerContent={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
                    <Button onClick={handleSubmit} isLoading={isLoading} leftIcon={<Save size={16} />}>
                        Save Changes
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <p className="text-sm text-red-500">{error}</p>}
                
                <div className={inputWrapperClass}>
                    <User className={inputIconClass} />
                    <input type="text" name="name" value={profile.name} onChange={handleChange} placeholder="Full Name" className={inputFieldStyledClass} required />
                </div>

                <div className={inputWrapperClass}>
                    <School className={inputIconClass} />
                    <input type="text" name="college" value={profile.college} onChange={handleChange} placeholder="College / Institution" className={inputFieldStyledClass} required />
                </div>
                
                <div className={inputWrapperClass}>
                    <Hash className={inputIconClass} />
                    <input type="text" name="universityNumber" value={profile.universityNumber} onChange={handleChange} placeholder="Registered University Number" className={inputFieldStyledClass} required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={inputWrapperClass}>
                        <Award className={inputIconClass} />
                        <select name="degreeType" value={profile.degreeType} onChange={handleChange} className={selectFieldStyledClass} required>
                            <option value="Bachelors">Bachelor's</option>
                            <option value="Masters">Master's</option>
                            <option value="PhD">PhD</option>
                            <option value="Diploma">Diploma</option>
                        </select>
                    </div>
                    
                    <div className={inputWrapperClass}>
                        <Wrench className={inputIconClass} />
                        <select name="branch" value={profile.branch} onChange={handleChange} className={selectFieldStyledClass} required>
                            <option value="Computer Science">Computer Science</option>
                            <option value="Mechanical Engineering">Mechanical</option>
                            <option value="Electrical Engineering">Electrical</option>
                            <option value="Civil Engineering">Civil</option>
                            <option value="Electronics & Communication">Electronics & Comm.</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className={inputWrapperClass}>
                        <Calendar className={inputIconClass} />
                        <select name="year" value={profile.year} onChange={handleChange} className={selectFieldStyledClass} required>
                            <option value="1st Year">1st Year</option>
                            <option value="2nd Year">2nd Year</option>
                            <option value="3rd Year">3rd Year</option>
                            <option value="4th Year">4th Year</option>
                            <option value="Final Year">Final Year</option>
                            <option value="Graduated">Graduated</option>
                        </select>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default ProfileSettingsModal;