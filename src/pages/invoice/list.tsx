import React from "react";
import {
    useDataGrid,
    EditButton,
    ShowButton,
    DeleteButton,
    List,
} from "@refinedev/mui";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import OpenInNewIcon from "@mui/icons-material/OpenInNew"; // Import the icon
import { IconButton, Tooltip } from "@mui/material"; 


export const InvoiceList = () => {
    const { dataGridProps } = useDataGrid();

    const columns = React.useMemo<GridColDef[]>(
        () => [
            {
                field: "id",
                headerName: "Id",
                minWidth: 50,
            },
            {
                field: "supplier_name.value",
                headerName: "Supplier Name",
                minWidth: 200,
                flex: 1,
                valueGetter: (params) => params.row.supplier_name?.value || "",
            },
            {
                field: "total_amount.value",
                headerName: "Total Amount",
                type: "number",
                minWidth: 150,
                flex: 1,
                valueGetter: (params) =>
                    parseFloat(params.row.total_amount?.value) || 0,
                    renderCell: (params) => `$${params.value.toFixed(2)}`,
            },
            {
                field: "receiver_name.value",
                headerName: "Receiver Name",
                minWidth: 200,
                flex: 1,
                valueGetter: (params) => params.row.receiver_name?.value || "",
            },
            {
                field: "url",
                headerName: "URL",
                minWidth: 100,
                sortable: false,
                renderCell: (params) => {
                    const url = params.value;
                    return url ? (
                        <Tooltip title="Open Link">
                            <IconButton
                                component="a"
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                color="primary"
                            >
                                <OpenInNewIcon />
                            </IconButton>
                        </Tooltip>
                    ) : null;
                },
                align: "center",
                headerAlign: "center",
            },
            {
                field: "actions",
                headerName: "Actions",
                sortable: false,
                renderCell: function render({ row }) {
                    return (
                        <>
                            <EditButton hideText recordItemId={row.id} />
                            <ShowButton hideText recordItemId={row.id} />
                            <DeleteButton hideText recordItemId={row.id} />
                        </>
                    );
                },
                align: "center",
                headerAlign: "center",
                minWidth: 80,
            },
        ],
        [],
    );

    return (
        <List>
            <DataGrid {...dataGridProps} columns={columns} autoHeight />
        </List>
    );
};
