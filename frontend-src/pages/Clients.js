import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { formatPhone, formatCurrency, getWhatsAppLink } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Phone, Mail, MapPin, Eye, Edit, Trash2, MessageCircle } from "lucide-react";

const ClientForm = ({ client, onSuccess, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: client?.name || "",
    cpf_cnpj: client?.cpf_cnpj || "",
    phone: client?.phone || "",
    email: client?.email || "",
    address: client?.address || "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (client) {
        await api.put(`/clients/${client.id}`, formData);
        toast.success("Cliente atualizado!");
      } else {
        await api.post("/clients", formData);
        toast.success("Cliente cadastrado!");
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          data-testid="client-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone *</Label>
          <Input
            id="phone"
            data-testid="client-phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(00) 00000-0000"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
          <Input
            id="cpf_cnpj"
            data-testid="client-cpf"
            value={formData.cpf_cnpj}
            onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          data-testid="client-email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Endereço</Label>
        <Input
          id="address"
          data-testid="client-address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} data-testid="client-submit">
          {loading ? "Salvando..." : client ? "Atualizar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
};

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  const fetchClients = async () => {
    try {
      const response = await api.get(`/clients${search ? `?search=${search}` : ""}`);
      setClients(response.data);
    } catch (error) {
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [search]);

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este cliente?")) return;
    
    try {
      await api.delete(`/clients/${id}`);
      toast.success("Cliente removido!");
      fetchClients();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao remover cliente");
    }
  };

  const openEditDialog = (client) => {
    setSelectedClient(client);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setSelectedClient(null);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6" data-testid="clients-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gerencie seus clientes</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedClient(null)} data-testid="new-client-btn">
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <ClientForm client={selectedClient} onSuccess={fetchClients} onClose={closeDialog} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou CPF..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="client-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Total Gasto</TableHead>
                    <TableHead className="hidden lg:table-cell">OS</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id} data-testid={`client-row-${client.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{client.name}</p>
                          {client.cpf_cnpj && (
                            <p className="text-xs text-muted-foreground">{client.cpf_cnpj}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{formatPhone(client.phone)}</span>
                          <a
                            href={getWhatsAppLink(client.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:text-emerald-700"
                            data-testid={`whatsapp-${client.id}`}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{client.email || "-"}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {formatCurrency(client.total_spent)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{client.orders_count}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link to={`/clients/${client.id}`}>
                            <Button variant="ghost" size="icon" data-testid={`view-client-${client.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(client)}
                            data-testid={`edit-client-${client.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(client.id)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`delete-client-${client.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Clients;
