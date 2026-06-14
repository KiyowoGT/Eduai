import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, EllipsisVertical, Edit, Trash2, BookOpen, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { http } from '@/lib/api';
import { useNavigate, useLocation } from 'react-router-dom'; // Import useLocation
import useMediaQuery from '@/hooks/useMediaQuery';

export default function DocumentCard({ doc, onDocDeleted }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); // Inisialisasi useLocation
  const isMobile = useMediaQuery('(max-width: 768px)'); // Hook untuk mendeteksi mobile
  const isDocumentDetailPage = location.pathname.startsWith('/dokumen/');

  const handleDelete = async () => {
    if (confirm(`Yakin ingin menghapus dokumen "${doc.title}"?`)) {
      try {
        await http.delete(`/documents/${doc.document_id}`);
        toast.success(`Dokumen "${doc.title}" berhasil dihapus.`);
        onDocDeleted(doc.document_id);
      } catch (error) {
        toast.error('Gagal menghapus dokumen.');
        // console.error('Failed to delete document:', error); // Dihapus
      }
    }
  };

  const handleEdit = () => {
    navigate(`/dokumen/edit/${doc.document_id}`);
  };

  const handleOpen = () => {
    navigate(`/dokumen/${doc.document_id}`);
  };

  return (
    <div className="relative group bg-[#1F2133] rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out border border-[#24283B] transform hover:-translate-y-1">
      <Link to={`/dokumen/${doc.document_id}`} className="block p-5 h-full">
        <div className="flex items-center space-x-3 mb-4">
          <FileText className="text-[#363B54] w-6 h-6 shrink-0" />
          <h3 className="text-lg font-semibold text-white leading-tight line-clamp-2">{doc.title}</h3>
        </div>
        <p className="text-[#A9B1D6] text-sm mb-4 line-clamp-3">{doc.summary}</p>
        <div className="text-xs text-[#646675] flex items-center justify-between">
          <span>
            Diunggah {formatDistanceToNow(new Date(doc.uploaded_at), { addSuffix: true, locale: id })}
          </span>
          <div className="flex items-center space-x-2">
            {doc.access_level === 'private' && (
              <span className="bg-[#1D2D50] text-[#A9B1D6] px-2 py-1 rounded-full text-xs">Private</span>
            )}
            {doc.access_level === 'public' && (
              <span className="bg-[#1D2D50] text-[#A9B1D6] px-2 py-1 rounded-full text-xs">Public</span>
            )}
          </div>
        </div>
      </Link>

      {/* Conditional overlay for hover effects */}
      {!(isMobile && isDocumentDetailPage) && (
        <div className="absolute inset-0 bg-[#1A1B26]/80 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
          <Button variant="ghost" size="icon" onClick={handleEdit} className="text-white hover:text-[#2563EB] transition-colors">
            <Edit className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleOpen} className="text-white hover:text-[#2563EB] transition-colors">
            <BookOpen className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDelete} className="text-white hover:text-red-500 transition-colors">
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}